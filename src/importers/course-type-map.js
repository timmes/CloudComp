/**
 * @module course-type-map
 *
 * Maps raw CourseType strings from AWS Skill Builder exports to
 * (category, subCategory) pairs in the new point config structure.
 *
 * No DOM access, no side-effects -- pure data.
 */

/**
 * Ordered mapping rules. First substring match wins (case-insensitive).
 * @type {ReadonlyArray<{match: string, category: string, subCategory: string}>}
 */
export const COURSE_TYPE_RULES = Object.freeze([
  { match: 'cloud quest',         category: 'selfPacedDigital', subCategory: 'Cloud Quest Role' },
  { match: 'escape room',         category: 'selfPacedDigital', subCategory: 'Escape Room Challenge' },
  { match: 'learning plan',       category: 'selfPacedDigital', subCategory: 'Skill Builder Learning Plan' },
  { match: 'builder lab',         category: 'selfPacedDigital', subCategory: 'Skill Builder Course' },
  { match: 'jam journey',         category: 'certifications',   subCategory: 'AWS Jam Challenge' },
  { match: 'jam',                 category: 'certifications',   subCategory: 'AWS Jam Challenge' },
  { match: 'simulearn',           category: 'selfPacedDigital', subCategory: 'Skill Builder Course' },
  { match: 'with lab',            category: 'selfPacedDigital', subCategory: 'Skill Builder Course' },
  { match: 'certification exam',  category: 'selfPacedDigital', subCategory: 'Skill Builder Course' },
  { match: 'classroom',           category: 'liveLearning',     subCategory: 'Workshop Full + Hands-on' },
  { match: 'quiz',                category: 'selfPacedDigital', subCategory: 'Quiz Completion' },
  { match: 'card clash',          category: 'selfPacedDigital', subCategory: 'Quiz Completion' },
]);

/** Default for courses that don't match any rule. */
export const DEFAULT_COURSE_MAPPING = Object.freeze({
  category: 'selfPacedDigital',
  subCategory: 'Skill Builder Course',
});

/**
 * Resolve a raw courseType string to a (category, subCategory) pair.
 *
 * @param {string} courseType - raw value from import source
 * @returns {{ category: string, subCategory: string }}
 */
export function resolveCourseMapping(courseType) {
  const ct = (courseType ?? '').toLowerCase();
  for (const rule of COURSE_TYPE_RULES) {
    if (ct.includes(rule.match)) {
      return { category: rule.category, subCategory: rule.subCategory };
    }
  }
  return { ...DEFAULT_COURSE_MAPPING };
}
