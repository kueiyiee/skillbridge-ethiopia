import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { ZodType } from 'zod';

export type AIProviderName = 'openai' | 'gemini';
export type AIProviderOutcome = 'success' | 'temporary_failure' | 'permanent_failure' | 'invalid_output' | 'refusal' | 'not_configured';

export interface StructuredAIRequest<T> {
  prompt: string;
  systemInstruction: string;
  responseJsonSchema: unknown;
  outputSchema: ZodType<T>;
  signal?: AbortSignal;
  maxOutputTokens?: number;
  onTextDelta?: (text: string) => void;
  onTextReset?: () => void;
}

export interface ProviderAdapter {
  verify: (signal?: AbortSignal) => Promise<void>;
  generate: (input: Omit<StructuredAIRequest<unknown>, 'outputSchema'>) => Promise<{ text?: string | null; refusal?: boolean }>;
}

export type GeminiClientLike = {
  models: {
    get: (input: { model: string; config?: { abortSignal?: AbortSignal } }) => Promise<{ supportedActions?: string[] }>;
  };
  interactions: {
    create: (input: {
      model: string;
      input: string;
      system_instruction: string;
      response_format: { type: 'text'; mime_type: 'application/json'; schema: unknown };
      generation_config: { temperature: number; max_output_tokens: number };
      store: false;
      stream?: true;
    }, options?: { signal?: AbortSignal }) => Promise<
      { output_text?: string | null; status?: string } | AsyncIterable<GeminiStreamEvent>
    >;
  };
};

type GeminiStreamEvent = {
  event_type?: string;
  delta?: { type?: string; text?: string };
  status?: string;
  interaction?: { status?: string };
};

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

export type OpenAIClientLike = Pick<OpenAI, 'models' | 'chat'>;

export interface StructuredAIResult<T> {
  data: T | null;
  provider: AIProviderName | null;
  fallbackUsed: boolean;
  fallbackReason?: 'not_configured' | 'timeout' | 'rate_limit' | 'service_unavailable' | 'connection';
  failure?: 'not_configured' | 'refusal' | 'invalid_output' | 'permanent_failure' | 'provider_unavailable';
}

interface ProviderHealth {
  configured: boolean;
  model: string;
  availability: 'not-configured' | 'not-checked' | 'available' | 'unavailable';
  structuredOutputValidated: boolean;
}

interface ProviderMetric {
  requests: number;
  fallbacks: number;
  failures: number;
  totalLatencyMs: number;
}

const modelCheckTtlMs = 5 * 60_000;
const defaultModels: Record<AIProviderName, string> = { openai: 'gpt-4.1-nano', gemini: 'gemini-3.8-flash' };
const health: Record<AIProviderName, ProviderHealth> = {
  openai: { configured: false, model: defaultModels.openai, availability: 'not-configured', structuredOutputValidated: false },
  gemini: { configured: false, model: defaultModels.gemini, availability: 'not-configured', structuredOutputValidated: false },
};
const metrics: Record<AIProviderName, ProviderMetric> = {
  openai: { requests: 0, fallbacks: 0, failures: 0, totalLatencyMs: 0 },
  gemini: { requests: 0, fallbacks: 0, failures: 0, totalLatencyMs: 0 },
};
const verifiedAt: Partial<Record<AIProviderName, number>> = {};
let openaiClient: OpenAI | undefined;
let geminiClient: GoogleGenAI | undefined;
let activeKeys = '';

export class AIProviderConfigurationError extends Error {}

export function parseStructuredOutput<T>(text: string | null | undefined, schema: ZodType<T>): T | undefined {
  if (!text) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function redactProviderInput(value: string): string {
  return value
    .replace(/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b|\bAIza[0-9A-Za-z_-]{20,}\b|\bAQ\.[A-Za-z0-9_-]{12,}\b/gi, '[credential removed]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [credential removed]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[credential removed]')
    .replace(/\b(password|passphrase|secret|token|api[_ -]?key|authorization)\b["']?\s*(?:is|:|=)\s*["']?[^\s"'`,;}]+/gi, '$1: [sensitive value removed]');
}

function providerName(value: string | undefined, fallback: AIProviderName): AIProviderName {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'openai' || normalized === 'gemini') return normalized;
  throw new AIProviderConfigurationError('AI_PRIMARY_PROVIDER and AI_FALLBACK_PROVIDER must be openai or gemini.');
}

function configuredApiKey(value: string | undefined): string | undefined {
  const key = value?.trim();
  if (!key) return undefined;
  const normalized = key.toLowerCase();
  if (normalized.startsWith('replace_with_') || normalized.startsWith('<') || normalized === 'your_api_key') return undefined;
  return key;
}

export function readAIConfiguration() {
  const primary = providerName(process.env.AI_PRIMARY_PROVIDER, 'openai');
  const fallback = providerName(process.env.AI_FALLBACK_PROVIDER, 'gemini');
  if (primary === fallback) throw new AIProviderConfigurationError('AI_PRIMARY_PROVIDER and AI_FALLBACK_PROVIDER must be different providers.');
  const keys = {
    openai: configuredApiKey(process.env.OPENAI_API_KEY),
    gemini: configuredApiKey(process.env.GEMINI_API_KEY),
  };
  const models = {
    openai: process.env.OPENAI_MODEL?.trim() || defaultModels.openai,
    gemini: process.env.GEMINI_MODEL?.trim() || defaultModels.gemini,
  };
  const configuredTimeout = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '', 10);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(25_000, Math.max(1_000, configuredTimeout)) : 12_000;
  return { primary, fallback, keys, models, timeoutMs };
}

export function extractJsonStringField(json: string, emittedLength = 0): string {
  const match = /"content"\s*:\s*"/.exec(json);
  if (!match) return '';

  const start = match.index + match[0].length;
  let end = start;
  while (end < json.length) {
    if (json[end] === '"') break;
    if (json[end] === '\\') {
      const escape = json[end + 1];
      if (escape === undefined) break;
      if (escape === 'u') {
        if (!/^[\da-f]{4}$/i.test(json.slice(end + 2, end + 6))) break;
        end += 6;
        continue;
      }
      if (!/["\\/bfnrt]/.test(escape)) break;
      end += 2;
      continue;
    }
    end += 1;
  }

  try {
    const decoded = JSON.parse(`"${json.slice(start, end)}"`) as string;
    return decoded.slice(emittedLength);
  } catch {
    return '';
  }
}

function syncClients() {
  const config = readAIConfiguration();
  const keySignature = `${config.keys.openai ?? ''}\u0000${config.keys.gemini ?? ''}\u0000${config.models.openai}\u0000${config.models.gemini}\u0000${config.timeoutMs}`;
  if (activeKeys !== keySignature) {
    activeKeys = keySignature;
    openaiClient = undefined;
    geminiClient = undefined;
    for (const name of ['openai', 'gemini'] as const) {
      health[name] = {
        configured: Boolean(config.keys[name]),
        model: config.models[name],
        availability: config.keys[name] ? 'not-checked' : 'not-configured',
        structuredOutputValidated: false,
      };
      delete verifiedAt[name];
    }
  }
  return config;
}

function getOpenAIClient(key: string): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key, timeout: readAIConfiguration().timeoutMs, maxRetries: 0 });
  return openaiClient;
}

function getGeminiClient(key: string): GoogleGenAI {
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: readAIConfiguration().timeoutMs } });
  return geminiClient;
}

export function createGeminiAdapter(client: GeminiClientLike, model: string): ProviderAdapter {
  return {
    verify: async (signal) => {
      const info = await client.models.get({ model, config: { abortSignal: signal } });
      if (!info.supportedActions?.some((action) => action.toLowerCase() === 'generatecontent')) {
        throw new AIProviderConfigurationError('Configured Gemini model does not support content generation.');
      }
    },
    generate: async ({ prompt, systemInstruction, responseJsonSchema, signal, maxOutputTokens, onTextDelta }) => {
      const request = {
        model,
        input: prompt,
        system_instruction: systemInstruction,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: makeStrictJsonSchema(responseJsonSchema),
        },
        generation_config: { temperature: 0.25, max_output_tokens: maxOutputTokens ?? 1400 },
        store: false,
      } as const;
      const response = onTextDelta
        ? await client.interactions.create({ ...request, stream: true }, { signal })
        : await client.interactions.create(request, { signal });

      if (onTextDelta && isAsyncIterable<GeminiStreamEvent>(response)) {
        let text = '';
        let emittedLength = 0;
        for await (const event of response as AsyncIterable<GeminiStreamEvent>) {
          if (event.event_type === 'step.delta' && event.delta?.type === 'text' && event.delta.text) {
            text += event.delta.text;
            const delta = extractJsonStringField(text, emittedLength);
            if (delta) {
              emittedLength += delta.length;
              onTextDelta(delta);
            }
          }
          if (event.event_type === 'interaction.status_update' && event.status === 'failed') {
            throw Object.assign(new Error('Gemini interaction failed.'), { status: 503 });
          }
        }
        return { text };
      }

      if ('status' in response && response.status?.toLowerCase() === 'failed') {
        throw Object.assign(new Error('Gemini interaction failed.'), { status: 503 });
      }
      return { text: 'output_text' in response ? response.output_text : undefined };
    },
  };
}

export function makeStrictJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(makeStrictJsonSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const source = schema as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) result[key] = makeStrictJsonSchema(value);
  if (source.type === 'object') {
    const properties = source.properties && typeof source.properties === 'object'
      ? source.properties as Record<string, unknown>
      : {};
    result.additionalProperties = false;
    result.required = Object.keys(properties);
  }
  return result;
}

export function createOpenAIAdapter(client: OpenAIClientLike, model: string): ProviderAdapter {
  return {
    verify: async (signal) => { await client.models.retrieve(model, { timeout: readAIConfiguration().timeoutMs, maxRetries: 0, signal }); },
    generate: async ({ prompt, systemInstruction, responseJsonSchema, signal, maxOutputTokens, onTextDelta }) => {
      const request = {
        model,
        messages: [{ role: 'system' as const, content: systemInstruction }, { role: 'user' as const, content: prompt }],
        response_format: {
          type: 'json_schema' as const,
          json_schema: { name: 'skillbridge_ai_response', strict: true, schema: makeStrictJsonSchema(responseJsonSchema) as Record<string, unknown> },
        },
        temperature: 0.25,
        max_completion_tokens: maxOutputTokens ?? 1400,
      };
      if (onTextDelta) {
        const stream = await client.chat.completions.create({ ...request, stream: true }, { signal });
        let text = '';
        let emittedLength = 0;
        let refusal = false;
        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          const delta = choice?.delta.content;
          if (typeof delta === 'string') {
            text += delta;
            const contentDelta = extractJsonStringField(text, emittedLength);
            if (contentDelta) {
              emittedLength += contentDelta.length;
              onTextDelta(contentDelta);
            }
          }
          refusal ||= Boolean(choice?.delta.refusal) || choice?.finish_reason === 'content_filter';
        }
        return { text, refusal };
      }

      const completion = await client.chat.completions.create(request, { signal });
      const choice = completion.choices[0];
      return { text: choice?.message.content, refusal: Boolean(choice?.message.refusal) || choice?.finish_reason === 'content_filter' };
    },
  };
}

export function createProviderAdapters(config = readAIConfiguration()): Partial<Record<AIProviderName, ProviderAdapter>> {
  const adapters: Partial<Record<AIProviderName, ProviderAdapter>> = {};
  if (config.keys.openai) adapters.openai = createOpenAIAdapter(getOpenAIClient(config.keys.openai), config.models.openai);
  if (config.keys.gemini) adapters.gemini = createGeminiAdapter(getGeminiClient(config.keys.gemini), config.models.gemini);
  return adapters;
}

export function isEligibleTemporaryFailure(error: unknown): { eligible: boolean; reason?: StructuredAIResult<unknown>['fallbackReason'] } {
  if (!error || typeof error !== 'object') return { eligible: false };
  const candidate = error as { status?: number; statusCode?: number; name?: string; code?: string };
  const status = candidate.status ?? candidate.statusCode;
  if (status === 429) return { eligible: true, reason: 'rate_limit' };
  if (status === 408 || status === 425) return { eligible: true, reason: 'timeout' };
  if (typeof status === 'number' && status >= 500) return { eligible: true, reason: 'service_unavailable' };
  const classification = `${candidate.name ?? ''} ${candidate.code ?? ''}`.toLowerCase();
  if (/timeout|timed.?out|etimedout|und_err_connect_timeout/.test(classification)) return { eligible: true, reason: 'timeout' };
  if (/connection|network|econn|fetchfailed/.test(classification)) return { eligible: true, reason: 'connection' };
  return { eligible: false };
}

export async function generateStructuredAIWithAdapters<T>(
  input: StructuredAIRequest<T>,
  config: {
    primary: AIProviderName;
    fallback: AIProviderName;
    configured: Partial<Record<AIProviderName, boolean>>;
    timeoutMs?: number;
  },
  adapters: Partial<Record<AIProviderName, ProviderAdapter>>,
): Promise<StructuredAIResult<T>> {
  const providerInput = {
    ...input,
    prompt: redactProviderInput(input.prompt),
    systemInstruction: redactProviderInput(input.systemInstruction),
  };
  const primaryConfigured = Boolean(configuredFor(config, config.primary));
  const fallbackConfigured = config.fallback !== config.primary && Boolean(configuredFor(config, config.fallback));
  const order: AIProviderName[] = primaryConfigured
    ? [config.primary, ...(fallbackConfigured ? [config.fallback] : [])]
    : fallbackConfigured ? [config.fallback] : [];
  if (!order.length) return { data: null, provider: null, fallbackUsed: false, failure: 'not_configured' };

  let fallbackReason: StructuredAIResult<T>['fallbackReason'] = primaryConfigured ? undefined : 'not_configured';
  let streamedText = false;
  for (let index = 0; index < order.length; index += 1) {
    const provider = order[index];
    const adapter = adapters[provider];
    if (!adapter) return { data: null, provider: null, fallbackUsed: false, failure: 'provider_unavailable' };
    const startedAt = Date.now();
    metrics[provider].requests += 1;
    const timeoutSignal = AbortSignal.timeout(config.timeoutMs ?? readAIConfiguration().timeoutMs);
    const signal = providerInput.signal
      ? AbortSignal.any([providerInput.signal, timeoutSignal])
      : timeoutSignal;
    let providerAttemptActive = true;
    const request = {
      ...providerInput,
      signal,
      onTextDelta: providerInput.onTextDelta
        ? (text: string) => {
          if (!providerAttemptActive) return;
          streamedText = true;
          providerInput.onTextDelta?.(text);
        }
        : undefined,
    };
    try {
      const response = await raceWithAbort((async () => {
        const lastVerifiedAt = verifiedAt[provider];
        if (!lastVerifiedAt || Date.now() - lastVerifiedAt >= modelCheckTtlMs) {
          await adapter.verify(signal);
          verifiedAt[provider] = Date.now();
        }
        return adapter.generate(request);
      })(), signal);
      providerAttemptActive = false;
      if (response.refusal) {
        health[provider].availability = 'available';
        metrics[provider].failures += 1;
        return { data: null, provider: null, fallbackUsed: false, failure: 'refusal' };
      }
      const data = parseStructuredOutput(response.text, input.outputSchema);
      if (!data) {
        metrics[provider].failures += 1;
        health[provider].availability = 'available';
        health[provider].structuredOutputValidated = false;
        return { data: null, provider: null, fallbackUsed: false, failure: 'invalid_output' };
      }
      const latency = Date.now() - startedAt;
      metrics[provider].totalLatencyMs += latency;
      health[provider].availability = 'available';
      health[provider].structuredOutputValidated = true;
      const fallbackUsed = provider !== config.primary;
      if (fallbackUsed) metrics[provider].fallbacks += 1;
      return { data, provider, fallbackUsed, fallbackReason };
    } catch (error) {
      providerAttemptActive = false;
      metrics[provider].totalLatencyMs += Date.now() - startedAt;
      if (providerInput.signal?.aborted) throw error;
      if (error instanceof AIProviderConfigurationError) {
        metrics[provider].failures += 1;
        health[provider].availability = error instanceof AIProviderConfigurationError ? 'unavailable' : 'available';
        return { data: null, provider: null, fallbackUsed: false };
      }
      const temporary = timeoutSignal.aborted
        ? { eligible: true, reason: 'timeout' as const }
        : isEligibleTemporaryFailure(error);
      metrics[provider].failures += 1;
      health[provider].availability = temporary.eligible ? 'unavailable' : 'available';
      const providerError = error && typeof error === 'object'
        ? error as { name?: unknown; status?: unknown; statusCode?: unknown }
        : {};
      const status = typeof providerError.status === 'number' ? providerError.status
        : typeof providerError.statusCode === 'number' ? providerError.statusCode
          : undefined;
      console.warn('[AI] Provider request failed.', {
        provider,
        errorType: typeof providerError.name === 'string' ? providerError.name : 'UnknownError',
        ...(status === undefined ? {} : { status }),
        failureClass: temporary.eligible ? temporary.reason : 'permanent_failure',
      });
      if (!temporary.eligible) return { data: null, provider: null, fallbackUsed: false, failure: 'permanent_failure' };
      if (index >= order.length - 1) return { data: null, provider: null, fallbackUsed: false, failure: 'provider_unavailable' };
      if (streamedText) {
        providerInput.onTextReset?.();
        streamedText = false;
      }
      fallbackReason = temporary.reason;
    }
  }
  return { data: null, provider: null, fallbackUsed: false };
}

function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void operation.catch(() => undefined);
    return Promise.reject(signal.reason ?? new Error('AI provider request was aborted.'));
  }

  let abortHandler: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abortHandler = () => reject(signal.reason ?? new Error('AI provider request was aborted.'));
    signal.addEventListener('abort', abortHandler, { once: true });
  });
  return Promise.race([operation, aborted]).finally(() => {
    if (abortHandler) signal.removeEventListener('abort', abortHandler);
  });
}

function configuredFor(config: { configured: Partial<Record<AIProviderName, boolean>> }, provider: AIProviderName): boolean {
  return config.configured[provider] === true;
}

export async function generateStructuredAI<T>(input: StructuredAIRequest<T>): Promise<StructuredAIResult<T>> {
  const config = syncClients();
  const configured = { openai: Boolean(config.keys.openai), gemini: Boolean(config.keys.gemini) };
  const adapters = createProviderAdapters(config);
  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  const result = await generateStructuredAIWithAdapters({
    ...input,
    onTextDelta: input.onTextDelta
      ? (text) => {
        firstTokenAt ??= Date.now();
        input.onTextDelta?.(text);
      }
      : undefined,
  }, { primary: config.primary, fallback: config.fallback, configured }, adapters);
  console.info('[AI] Generation completed.', {
    provider: result.provider ?? 'none',
    latencyMs: Date.now() - startedAt,
    ...(firstTokenAt === undefined ? {} : { firstTokenMs: firstTokenAt - startedAt }),
    fallbackUsed: result.fallbackUsed,
    outputValidated: Boolean(result.data),
    ...(result.failure ? { failure: result.failure } : {}),
  });
  return result;
}

export function validateAIProviderConfiguration(): void {
  readAIConfiguration();
}

export async function verifyAIProviderAccess(): Promise<void> {
  const config = syncClients();
  const adapters = createProviderAdapters(config);
  await Promise.all((['openai', 'gemini'] as const).map(async (provider) => {
    const adapter = adapters[provider];
    if (!adapter) return;
    try {
      const checkedAt = verifiedAt[provider];
      if (!checkedAt || Date.now() - checkedAt >= modelCheckTtlMs) {
        await adapter.verify();
        verifiedAt[provider] = Date.now();
      }
      health[provider].availability = 'available';
    } catch (error) {
      health[provider].availability = 'unavailable';
      console.warn(`[AI] ${provider} model check failed:`, error instanceof Error ? error.name : 'UnknownError');
    }
  }));
}

export function getAIProviderStatus() {
  const config = syncClients();
  return {
    primaryProvider: config.primary,
    fallbackProvider: config.fallback,
    providers: {
      openai: { ...health.openai, configured: Boolean(config.keys.openai), model: config.models.openai },
      gemini: { ...health.gemini, configured: Boolean(config.keys.gemini), model: config.models.gemini },
    },
    usage: {
      openai: metrics.openai.requests ? { requests: metrics.openai.requests, fallbacks: metrics.openai.fallbacks, failures: metrics.openai.failures, averageLatencyMs: Math.round(metrics.openai.totalLatencyMs / metrics.openai.requests) } : { requests: 0, fallbacks: 0, failures: 0, averageLatencyMs: 0 },
      gemini: metrics.gemini.requests ? { requests: metrics.gemini.requests, fallbacks: metrics.gemini.fallbacks, failures: metrics.gemini.failures, averageLatencyMs: Math.round(metrics.gemini.totalLatencyMs / metrics.gemini.requests) } : { requests: 0, fallbacks: 0, failures: 0, averageLatencyMs: 0 },
    },
    configured: Boolean(config.keys.openai || config.keys.gemini),
  };
}

export function resetAIProviderTestState(): void {
  for (const provider of ['openai', 'gemini'] as const) {
    metrics[provider] = { requests: 0, fallbacks: 0, failures: 0, totalLatencyMs: 0 };
    health[provider].structuredOutputValidated = false;
    health[provider].availability = health[provider].configured ? 'not-checked' : 'not-configured';
    delete verifiedAt[provider];
  }
}
