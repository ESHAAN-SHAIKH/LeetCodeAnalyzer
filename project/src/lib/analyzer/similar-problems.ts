/**
 * Similar problems finder — uses bundled problem metadata to find
 * 3-5 problems sharing core technique/tags with the analyzed problem.
 */

import blind75 from '../../data/lists/blind75.json';
import neetcode150 from '../../data/lists/neetcode150.json';
import grind75 from '../../data/lists/grind75.json';

interface Problem {
  slug: string;
  title: string;
  difficulty: string;
  acceptance: number;
  tags: string[];
  lists: string[];
}

interface SimilarProblem {
  slug: string;
  title: string;
  difficulty: string;
  listMembership: string[];
  sharedTags: string[];
  leetcodeUrl: string;
}

// Merge all lists into a deduplicated map
function buildProblemMap(): Map<string, Problem> {
  const map = new Map<string, Problem>();
  for (const p of [...blind75, ...neetcode150, ...grind75]) {
    if (!map.has(p.slug)) {
      map.set(p.slug, p as Problem);
    }
  }
  return map;
}

const PROBLEM_MAP = buildProblemMap();

export function findSimilarProblems(
  problemSlug: string | null | undefined,
  detectedTechniques: string[],
  maxResults = 5,
): SimilarProblem[] {
  const results: SimilarProblem[] = [];

  if (!problemSlug) {
    // Without a slug, return problems matching detected techniques
    return findByTechniques(detectedTechniques, maxResults);
  }

  const target = PROBLEM_MAP.get(problemSlug.toLowerCase().trim());
  if (!target) {
    return findByTechniques(detectedTechniques, maxResults);
  }

  const targetTags = new Set(target.tags);

  // Score all problems by tag overlap with target
  const candidates: Array<{ problem: Problem; score: number; sharedTags: string[] }> = [];

  for (const [slug, problem] of PROBLEM_MAP) {
    if (slug === problemSlug) continue;

    const shared = problem.tags.filter((t) => targetTags.has(t));
    if (shared.length >= 1) {
      // Prefer problems in prep lists
      const listBonus = problem.lists.length > 0 ? 2 : 0;
      candidates.push({ problem, score: shared.length + listBonus, sharedTags: shared });
    }
  }

  // Sort: most shared tags first, then by list membership, then by acceptance (higher = more accessible)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.problem.acceptance - a.problem.acceptance;
  });

  for (const { problem, sharedTags } of candidates.slice(0, maxResults)) {
    results.push({
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      listMembership: problem.lists,
      sharedTags,
      leetcodeUrl: `https://leetcode.com/problems/${problem.slug}/`,
    });
  }

  return results;
}

function findByTechniques(techniques: string[], maxResults: number): SimilarProblem[] {
  if (techniques.length === 0) return [];

  const techniqueKeywords = techniques.join(' ').toLowerCase();
  const candidates: Array<{ problem: Problem; score: number }> = [];

  for (const [, problem] of PROBLEM_MAP) {
    let score = 0;

    // Match technique keywords against problem tags
    for (const tag of problem.tags) {
      const tagLower = tag.toLowerCase();
      if (
        techniqueKeywords.includes('hash') && tagLower.includes('hash') ||
        techniqueKeywords.includes('recursion') && (tagLower.includes('recursion') || tagLower.includes('dynamic')) ||
        techniqueKeywords.includes('sort') && tagLower.includes('sort') ||
        techniqueKeywords.includes('binary search') && tagLower.includes('binary search') ||
        techniqueKeywords.includes('sliding') && tagLower.includes('sliding') ||
        techniqueKeywords.includes('two pointer') && tagLower.includes('two pointer') ||
        techniqueKeywords.includes('tree') && tagLower.includes('tree') ||
        techniqueKeywords.includes('graph') && tagLower.includes('graph')
      ) {
        score++;
      }
    }

    if (score > 0) {
      const listBonus = problem.lists.length > 0 ? 1 : 0;
      candidates.push({ problem, score: score + listBonus });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, maxResults).map(({ problem }) => ({
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    listMembership: problem.lists,
    sharedTags: problem.tags.slice(0, 3),
    leetcodeUrl: `https://leetcode.com/problems/${problem.slug}/`,
  }));
}
