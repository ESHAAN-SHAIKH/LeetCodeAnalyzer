/**
 * Pattern matcher — cross-references detected complexity against known-optimal
 * patterns from optimal-patterns.json. Surfaces "better approach" suggestions.
 */

import optimalPatterns from '../../data/optimal-patterns.json';

export interface PatternMatchResult {
  problemKnown: boolean;
  currentComplexityIsOptimal: boolean | null;
  betterApproach: BetterApproachSuggestion | null;
  genericRedFlags: string[];
}

export interface BetterApproachSuggestion {
  technique: string;
  optimalComplexity: string;
  explanation: string;
}

const COMPLEXITY_ORDER = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2ⁿ)', 'O(n!)'];

function complexityRank(complexity: string): number {
  const normalized = complexity.replace(/\s+/g, '').toLowerCase();
  for (let i = 0; i < COMPLEXITY_ORDER.length; i++) {
    if (COMPLEXITY_ORDER[i].replace(/\s+/g, '').toLowerCase() === normalized) return i;
  }
  // Unknown complexity — assume medium rank
  return 4;
}

function isWorseThan(detected: string, optimal: string): boolean {
  return complexityRank(detected) > complexityRank(optimal);
}

export function matchPattern(
  problemSlug: string | null | undefined,
  detectedTimeComplexity: string,
  triggeringConstructs: string[],
  hashStructures: number,
): PatternMatchResult {
  const genericRedFlags: string[] = [];

  // Generic red flags (language-agnostic)
  const isNestedLoop = triggeringConstructs.some((c) => c.includes('nested') || c.includes('2-level') || c.includes('3-level'));
  if (isNestedLoop && hashStructures === 0) {
    genericRedFlags.push(
      'Nested loops found with no hash map/set. If you\'re searching for elements in the inner loop, a hash map lookup would reduce this to O(n).'
    );
  }
  const isExponential = detectedTimeComplexity.includes('2ⁿ') || detectedTimeComplexity.includes('2^n');
  if (isExponential) {
    genericRedFlags.push(
      'Exponential time complexity detected (O(2ⁿ)). Consider memoization (top-down DP) or converting to bottom-up DP to reduce to polynomial time.'
    );
  }

  // If no problem slug, return generic analysis only
  if (!problemSlug) {
    return {
      problemKnown: false,
      currentComplexityIsOptimal: null,
      betterApproach: null,
      genericRedFlags,
    };
  }

  // Normalize slug (handle minor variations)
  const normalizedSlug = problemSlug.toLowerCase().trim().replace(/\s+/g, '-');
  const pattern = (optimalPatterns as Record<string, {
    optimalComplexity: string;
    optimalSpace: string;
    technique: string;
    explanation: string;
  }>)[normalizedSlug];

  if (!pattern) {
    return {
      problemKnown: false,
      currentComplexityIsOptimal: null,
      betterApproach: null,
      genericRedFlags,
    };
  }

  const isWorse = isWorseThan(detectedTimeComplexity, pattern.optimalComplexity);

  return {
    problemKnown: true,
    currentComplexityIsOptimal: !isWorse,
    betterApproach: isWorse
      ? {
          technique: pattern.technique,
          optimalComplexity: pattern.optimalComplexity,
          explanation: pattern.explanation,
        }
      : null,
    genericRedFlags,
  };
}
