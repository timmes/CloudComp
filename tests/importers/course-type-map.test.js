import { describe, it, expect } from 'vitest';
import {
  COURSE_TYPE_RULES,
  DEFAULT_COURSE_MAPPING,
  resolveCourseMapping,
} from '../../src/importers/course-type-map.js';

// ── COURSE_TYPE_RULES ────────────────────────────────────────────────

describe('COURSE_TYPE_RULES', () => {
  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(COURSE_TYPE_RULES)).toBe(true);
  });

  it('has exactly 12 entries', () => {
    expect(COURSE_TYPE_RULES).toHaveLength(12);
  });
});

// ── DEFAULT_COURSE_MAPPING ───────────────────────────────────────────

describe('DEFAULT_COURSE_MAPPING', () => {
  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(DEFAULT_COURSE_MAPPING)).toBe(true);
  });

  it('has category selfPacedDigital', () => {
    expect(DEFAULT_COURSE_MAPPING.category).toBe('selfPacedDigital');
  });

  it('has subCategory Skill Builder Course', () => {
    expect(DEFAULT_COURSE_MAPPING.subCategory).toBe('Skill Builder Course');
  });
});

// ── resolveCourseMapping ─────────────────────────────────────────────

describe('resolveCourseMapping', () => {
  it('resolves Cloud Quest title to Cloud Quest Role', () => {
    expect(resolveCourseMapping('AWS Cloud Quest: Cloud Practitioner')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Cloud Quest Role',
    });
  });

  it('resolves Escape Room title to Escape Room Challenge', () => {
    expect(resolveCourseMapping('Escape Room: Exam Prep')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Escape Room Challenge',
    });
  });

  it('resolves Learning Plan title to Skill Builder Learning Plan', () => {
    expect(resolveCourseMapping('Solutions Architect Learning Plan')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Learning Plan',
    });
  });

  it('resolves Builder Lab title to Skill Builder Course', () => {
    expect(resolveCourseMapping('Builder Lab: VPC Networking')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('resolves Jam Journey title to AWS Jam Challenge', () => {
    expect(resolveCourseMapping('Jam Journey: Serverless')).toEqual({
      category: 'certifications',
      subCategory: 'AWS Jam Challenge',
    });
  });

  it('resolves AWS Jam (non-journey) title to AWS Jam Challenge', () => {
    expect(resolveCourseMapping('AWS Jam')).toEqual({
      category: 'certifications',
      subCategory: 'AWS Jam Challenge',
    });
  });

  it('resolves SimuLearn title to Skill Builder Course', () => {
    expect(resolveCourseMapping('SimuLearn: Database Migration')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('resolves "with lab" title to Skill Builder Course', () => {
    expect(resolveCourseMapping('Introduction to EC2 with Lab')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('resolves Certification Exam title to Skill Builder Course', () => {
    expect(resolveCourseMapping('Certification Exam Readiness')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('resolves Classroom title to Workshop Full + Hands-on', () => {
    expect(resolveCourseMapping('Classroom Training: Advanced')).toEqual({
      category: 'liveLearning',
      subCategory: 'Workshop Full + Hands-on',
    });
  });

  it('resolves Quiz title to Quiz Completion', () => {
    expect(resolveCourseMapping('Knowledge Quiz: S3')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Quiz Completion',
    });
  });

  it('resolves AWS Card Clash to Quiz Completion', () => {
    expect(resolveCourseMapping('AWS Card Clash')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Quiz Completion',
    });
  });

  it('returns default mapping for unrecognized input', () => {
    expect(resolveCourseMapping('Some Unknown Course Type')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('is case-insensitive: AWS CLOUD QUEST maps to Cloud Quest Role', () => {
    expect(resolveCourseMapping('AWS CLOUD QUEST')).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Cloud Quest Role',
    });
  });

  it('returns default mapping for null input', () => {
    expect(resolveCourseMapping(null)).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('returns default mapping for undefined input', () => {
    expect(resolveCourseMapping(undefined)).toEqual({
      category: 'selfPacedDigital',
      subCategory: 'Skill Builder Course',
    });
  });

  it('returns a new object each time for the default (not reference-equal)', () => {
    const a = resolveCourseMapping('Unrecognized A');
    const b = resolveCourseMapping('Unrecognized B');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
