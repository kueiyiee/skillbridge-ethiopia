import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { securityHeaders } from './security';

function invokeSecurityHeaders(secure: boolean) {
  const headers = new Map<string, string>();
  let nextCalled = false;
  const req = { secure } as Request;
  const res = {
    setHeader(name: string, value: string | number) {
      headers.set(name.toLowerCase(), String(value));
      return this;
    },
  } as unknown as Response;

  securityHeaders(req, res, (() => { nextCalled = true; }) as never);
  return { headers, nextCalled };
}

test('security headers include safe defaults and continue the middleware chain', () => {
  const { headers, nextCalled } = invokeSecurityHeaders(false);

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('x-dns-prefetch-control'), 'off');
  assert.equal(headers.get('x-permitted-cross-domain-policies'), 'none');
  assert.equal(headers.has('x-xss-protection'), false);
  assert.equal(nextCalled, true);
});

test('HSTS is enabled only for secure production requests', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';
    const secure = invokeSecurityHeaders(true);
    const insecure = invokeSecurityHeaders(false);

    assert.equal(secure.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal(insecure.headers.has('strict-transport-security'), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('HSTS is not enabled in development, even for secure requests', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'development';
    const { headers } = invokeSecurityHeaders(true);
    assert.equal(headers.has('strict-transport-security'), false);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
