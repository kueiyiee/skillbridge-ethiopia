import { SkillLevel } from '../../../shared/types';
import { loadJobMatchData } from './job-matching.repository';

export interface MatchingWeightsConfig {
  skillWeight?: number;
  experienceWeight?: number;
}

const proficiencyRanks: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4
};

const projectTemplates: Record<string, { projectTitle: string; projectDescription: string; practicalExercises: string[] }> = {
  postgresql: {
    projectTitle: 'ACID-Compliant Payment Ledger & Query Optimization',
    projectDescription: 'Design a high-throughput transaction ledger database with strict foreign keys, composite indexes, partition pruning, and idempotent transfer transactions.',
    practicalExercises: [
      'Write complex multi-table analytical queries with window functions (RANK, ROW_NUMBER, PARTITION BY).',
      'Benchmark and optimize query latency using EXPLAIN ANALYZE on a 100k row dataset.',
      'Configure row-level locking (SELECT FOR UPDATE) to eliminate double-spend race conditions.'
    ]
  },
  typescript: {
    projectTitle: 'Strict-Mode Enterprise REST API with Type Validation',
    projectDescription: 'Construct a Node.js backend using TypeScript in strict mode, generating compile-time checked request/response contracts and Zod runtime schema validators.',
    practicalExercises: [
      'Implement discriminated unions and generic utility types for API responses.',
      'Refactor untyped parameters into rigorous mapped types and interfaces.',
      'Set up strict ESLint rules and noImplicitAny in tsconfig.json.'
    ]
  },
  docker: {
    projectTitle: 'Multi-Stage Production Containerization & Local Dev Compose',
    projectDescription: 'Package a full-stack Node.js + MySQL application using multi-stage Dockerfiles that minimize image size and provide healthcheck readiness probes.',
    practicalExercises: [
      'Write a 2-stage Dockerfile that drops build dependencies and runs as a non-root user.',
      'Set up docker-compose.yml with healthchecks, persistent volumes, and custom bridge networks.',
      'Test container shutdown signals (SIGTERM) for graceful connection draining.'
    ]
  },
  'react.js': {
    projectTitle: 'Accessible State-Managed Dashboard with Custom Hooks',
    projectDescription: 'Build an interactive web application with optimistic UI updates, debounced search filters, responsive grids, and full keyboard navigation.',
    practicalExercises: [
      'Build custom hooks for asynchronous data fetching, caching, and abort-controller cleanup.',
      'Audit accessibility compliance using axe-core and keyboard-only navigation.',
      'Use React Profiler to locate and address rendering bottlenecks.'
    ]
  },
  'node.js': {
    projectTitle: 'Scalable Microservices Gateway with Rate Limiting & Auth',
    projectDescription: 'Develop an Express/Node.js gateway featuring JWT verification, rate limits, and structured audit logging.',
    practicalExercises: [
      'Implement centralized handling of operational and programmer errors.',
      'Build stream processing for large payloads without blocking the event loop.',
      'Write automated integration tests against an isolated database.'
    ]
  }
};

export async function calculateJobMatch(jobId: string, jobSeekerId: string, weightsConfig?: MatchingWeightsConfig) {
  const matchData = await loadJobMatchData(jobId, jobSeekerId);
  if (!matchData) throw new Error('Job not found');
  const { job, requirements, candidateProfile, candidateSkills } = matchData;
  const requiredYears = job.minExperienceYears || 0;
  const candidateYears = candidateProfile?.experienceYears || 0;
  const candidateSkillMap = new Map<string, any>();
  candidateSkills.forEach((skill) => candidateSkillMap.set(skill.skillName.toLowerCase(), skill));

  const rawSkillWeight = weightsConfig?.skillWeight ?? 0.7;
  const rawExperienceWeight = weightsConfig?.experienceWeight ?? 0.3;
  const weightSum = rawSkillWeight + rawExperienceWeight;
  const normalizedSkillWeight = weightSum > 0 ? rawSkillWeight / weightSum : 0.7;
  const normalizedExperienceWeight = weightSum > 0 ? rawExperienceWeight / weightSum : 0.3;
  let totalRequirementWeight = 0;
  let earnedRequirementWeight = 0;
  const matchedSkills: any[] = [];
  const missingSkills: any[] = [];
  const actionableInsights: string[] = [];

  for (const requirement of requirements) {
    const weight = requirement.weight * (requirement.isMandatory ? 1.5 : 1);
    totalRequirementWeight += weight;
    const candidateSkill = candidateSkillMap.get(requirement.skillName.toLowerCase());
    const requiredRank = proficiencyRanks[requirement.requiredLevel as SkillLevel] || 2;

    if (candidateSkill) {
      const candidateRank = proficiencyRanks[candidateSkill.proficiencyLevel as SkillLevel] || 2;
      const ratio = Math.min(1, candidateRank / requiredRank);
      earnedRequirementWeight += weight * ratio;
      matchedSkills.push({
        skill: requirement.skillName,
        candidateLevel: candidateSkill.proficiencyLevel,
        requiredLevel: requirement.requiredLevel,
        levelRatio: ratio,
        category: requirement.category,
        isVerified: Boolean(candidateSkill.isVerified),
        verificationStatus: candidateSkill.isVerified ? 'VERIFIED' : 'SELF_REPORTED'
      });
      if (ratio < 1) actionableInsights.push(`Deepen ${requirement.skillName} from ${candidateSkill.proficiencyLevel} to ${requirement.requiredLevel} to fully satisfy job criteria.`);
      continue;
    }

    const severity = requirement.isMandatory ? 'CRITICAL' : (requirement.weight >= 4 ? 'HIGH' : requirement.weight === 3 ? 'MEDIUM' : 'LOW');
    const template = projectTemplates[requirement.skillName.toLowerCase()] || {
      projectTitle: `Hands-on Portfolio Application using ${requirement.skillName}`,
      projectDescription: `Build and publish a real-world repository demonstrating clean architectural patterns with ${requirement.skillName}.`,
      practicalExercises: [
        `Study core API and best practice standards for ${requirement.skillName}.`,
        `Construct an end-to-end working module with unit tests and typed schemas.`,
        `Document deployment, configuration, and performance characteristics.`
      ]
    };
    missingSkills.push({
      skill: requirement.skillName,
      requiredLevel: requirement.requiredLevel,
      weight: requirement.weight,
      isMandatory: requirement.isMandatory,
      gapSeverity: severity,
      priority: requirement.isMandatory ? 'Immediate Priority' : 'Recommended Next Step',
      category: requirement.category,
      source: 'JOB_REQUIREMENT',
      recommendedProject: template.projectTitle,
      projectDescription: template.projectDescription,
      practicalExercises: template.practicalExercises
    });
    if (requirement.isMandatory) actionableInsights.push(`Mandatory Prerequisite: ${requirement.skillName} at ${requirement.requiredLevel} level is essential for "${job.title}".`);
  }

  const skillScore = totalRequirementWeight > 0 ? Math.round((earnedRequirementWeight / totalRequirementWeight) * 100) : 100;
  let experienceScore = 100;
  let experienceStatus: 'EXCEEDS' | 'MEETS' | 'DEVELOPING' = 'MEETS';
  let experienceDetail = `Matches the required ${requiredYears} years of experience.`;
  if (requiredYears > 0) {
    if (candidateYears >= requiredYears) {
      experienceStatus = candidateYears > requiredYears ? 'EXCEEDS' : 'MEETS';
      experienceDetail = candidateYears > requiredYears
        ? `Exceeds experience requirement (${candidateYears} yrs vs ${requiredYears} yrs required).`
        : `Meets requirement with ${candidateYears} years experience.`;
    } else {
      experienceScore = Math.round((candidateYears / requiredYears) * 100);
      experienceStatus = 'DEVELOPING';
      experienceDetail = `Candidate has ${candidateYears} years of experience (target: ${requiredYears} yrs). Strong skills can bridge this difference.`;
    }
  }

  const profileEmpty = candidateSkills.length === 0 && candidateYears === 0;
  const overallScore = profileEmpty ? 0 : Math.round(skillScore * normalizedSkillWeight + experienceScore * normalizedExperienceWeight);
  let recommendationReason: string;
  if (profileEmpty) {
    recommendationReason = 'Profile Incomplete: Add your competencies and professional experience to generate an accurate compatibility score.';
  } else if (overallScore >= 80) {
    recommendationReason = `High Compatibility: You satisfy ${matchedSkills.length} of ${requirements.length} required skills and your experience (${candidateYears} yrs) aligns well with the role requirements.`;
  } else if (overallScore >= 50) {
    recommendationReason = `Moderate Match: Strong foundation in ${matchedSkills.map((skill) => skill.skill).slice(0, 2).join(', ') || 'software core'}, but bridging ${missingSkills.length} identified technical gaps will improve alignment.`;
  } else {
    recommendationReason = `Growth Opportunity: Several mandatory competencies (e.g. ${missingSkills.filter((skill) => skill.isMandatory).map((skill) => skill.skill).join(', ') || 'key tools'}) are required. Follow the structured roadmap below to prepare.`;
  }

  return {
    jobId,
    jobTitle: job.title,
    overallMatchScore: overallScore,
    scoringBreakdown: {
      skillScore,
      skillWeight: parseFloat(normalizedSkillWeight.toFixed(2)),
      experienceScore,
      experienceWeight: parseFloat(normalizedExperienceWeight.toFixed(2)),
      formula: `Score = (${skillScore} × ${normalizedSkillWeight.toFixed(2)}) + (${experienceScore} × ${normalizedExperienceWeight.toFixed(2)}) = ${overallScore}%`
    },
    experienceAlignment: { candidateYears, requiredYears, score: experienceScore, status: experienceStatus, detail: experienceDetail },
    recommendationReason,
    disclaimer: 'A compatibility score is a mathematical reflection of requirement alignment, not a probability or guarantee of being hired. Final recruitment decisions are made through comprehensive human evaluation by the employer team.',
    ethicalGuardrails: {
      sensitiveAttributesExcluded: true,
      statement: 'SKILLBRIDGE evaluates competencies, proficiency levels, and stated experience years. Sensitive personal characteristics are not used in matching. Candidates are never automatically rejected by AI.',
      autoRejectionEnabled: false
    },
    matchedSkills,
    missingSkills,
    strengths: matchedSkills.length ? matchedSkills.map((skill) => `Proficient in ${skill.skill} (${skill.candidateLevel})`) : ['Foundational computing training'],
    actionableInsights: actionableInsights.length ? actionableInsights : ['Your profile matches all specified requirements.'],
    roadmapRecommendations: missingSkills.map((skill, index) => ({
      phase: `Milestone ${index + 1}: ${skill.skill}`,
      targetSkill: skill.skill,
      priority: skill.gapSeverity,
      isMandatory: skill.isMandatory,
      estimatedHours: skill.isMandatory ? 40 : 25,
      practicalProject: skill.recommendedProject,
      projectDescription: skill.projectDescription,
      practicalExercises: skill.practicalExercises,
      recommendedActions: [
        `Review documentation and standard conventions for ${skill.skill}.`,
        `Complete practical project: "${skill.recommendedProject}".`,
        `Commit code to GitHub and update candidate profile proficiency to ${skill.requiredLevel}.`
      ]
    }))
  };
}