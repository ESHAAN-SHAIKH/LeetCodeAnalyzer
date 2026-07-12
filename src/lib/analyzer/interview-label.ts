/**
 * Interview difficulty label — composite label from:
 * - Official difficulty (Easy/Medium/Hard)
 * - Acceptance rate (lower = harder in practice)
 * - Prep list membership count (more lists = more "common" in interviews)
 * 
 * Never fabricates company-tag data. All data is local.
 * Always shows the breakdown of what fed the label.
 */

import blind75 from '../../data/lists/blind75.json';
import neetcode150 from '../../data/lists/neetcode150.json';
import grind75 from '../../data/lists/grind75.json';

export type InterviewLabel =
  | 'Very Common'
  | 'Common'
  | 'Moderate'
  | 'Rare'
  | 'Very Rare';

export interface InterviewLabelResult {
  label: InterviewLabel;
  labelColor: 'emerald' | 'brand' | 'amber' | 'slate' | 'rose';
  explanation: string;
  breakdown: {
    difficulty: string;
    acceptanceRate: number | null;
    listCount: number;
    listsIn: string[];
  };
}

interface ProblemEntry {
  slug: string;
  difficulty: string;
  acceptance: number;
  lists: string[];
}

// Build a lookup map from all lists
const allProblems = new Map<string, ProblemEntry>();
for (const p of [...blind75, ...neetcode150, ...grind75]) {
  const existing = allProblems.get(p.slug);
  if (existing) {
    // Merge list membership
    existing.lists = [...new Set([...existing.lists, ...p.lists])];
  } else {
    allProblems.set(p.slug, {
      slug: p.slug,
      difficulty: p.difficulty,
      acceptance: p.acceptance,
      lists: [...p.lists],
    });
  }
}

const LIST_NAMES: Record<string, string> = {
  blind75: 'Blind 75',
  neetcode150: 'NeetCode 150',
  grind75: 'Grind 75',
};

export function computeInterviewLabel(
  problemSlug: string | null | undefined,
): InterviewLabelResult {
  if (!problemSlug) {
    return {
      label: 'Moderate',
      labelColor: 'amber',
      explanation: 'Problem not in the bundled dataset. Difficulty label is unavailable for unrecognized problems.',
      breakdown: { difficulty: 'Unknown', acceptanceRate: null, listCount: 0, listsIn: [] },
    };
  }

  const problem = allProblems.get(problemSlug.toLowerCase().trim());

  if (!problem) {
    return {
      label: 'Moderate',
      labelColor: 'amber',
      explanation: 'Problem not recognized in the bundled dataset. Difficulty label not available.',
      breakdown: { difficulty: 'Unknown', acceptanceRate: null, listCount: 0, listsIn: [] },
    };
  }

  const listCount = problem.lists.length;
  const listsIn = problem.lists.map((l) => LIST_NAMES[l] ?? l);
  const acceptance = problem.acceptance;
  const difficulty = problem.difficulty;

  // Score: 0–10
  let score = 0;

  // Difficulty contribution
  if (difficulty === 'Easy') score += 2;
  else if (difficulty === 'Medium') score += 1;
  else if (difficulty === 'Hard') score += 0;

  // List membership (each list = +3 points)
  score += listCount * 3;

  // Acceptance rate (higher acceptance = easier = more likely asked in interviews)
  if (acceptance >= 60) score += 2;
  else if (acceptance >= 45) score += 1;
  else if (acceptance < 30) score -= 1;

  // Determine label
  let label: InterviewLabel;
  let labelColor: InterviewLabelResult['labelColor'];

  if (score >= 8) {
    label = 'Very Common';
    labelColor = 'emerald';
  } else if (score >= 5) {
    label = 'Common';
    labelColor = 'brand';
  } else if (score >= 3) {
    label = 'Moderate';
    labelColor = 'amber';
  } else if (score >= 1) {
    label = 'Rare';
    labelColor = 'slate';
  } else {
    label = 'Very Rare';
    labelColor = 'rose';
  }

  // Build honest explanation
  const listMentions =
    listsIn.length > 0
      ? `This problem appears in ${listsIn.join(', ')} (${listCount} of the 3 tracked prep lists).`
      : 'This problem is not in any of the 3 tracked prep lists (Blind 75, NeetCode 150, Grind 75).';

  const difficultyNote = `Official difficulty: ${difficulty}. Acceptance rate: ${acceptance}%.`;

  const explanation = `${listMentions} ${difficultyNote} Label derived from prep-list membership, difficulty, and acceptance rate — not from live company interview data.`;

  return {
    label,
    labelColor,
    explanation,
    breakdown: { difficulty, acceptanceRate: acceptance, listCount, listsIn },
  };
}
