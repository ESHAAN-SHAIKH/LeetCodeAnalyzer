/**
 * Complexity estimator — walks parse results and derives Big-O estimates.
 * Returns honest "Estimated" labels, not formal proofs.
 * 
 * SECURITY: This module never executes user code. It only reads parse results.
 * Hard timeout: 3 seconds enforced by the caller (index.ts).
 */

import type { PythonParseResult } from './parsers/python-parser';
import type { JavaParseResult } from './parsers/java-parser';
import type { CppParseResult } from './parsers/cpp-parser';
import type { Program } from 'estree';

export interface ComplexityResult {
  timeComplexity: string;
  spaceComplexity: string;
  timeExplanation: string;
  spaceExplanation: string;
  triggeringConstructs: string[];
  confidence: 'high' | 'medium' | 'low';
  isEstimate: true;   // always true — we never claim this is a formal proof
}

type ParsedInput =
  | { kind: 'python'; data: PythonParseResult }
  | { kind: 'java'; data: JavaParseResult }
  | { kind: 'cpp'; data: CppParseResult }
  | { kind: 'js'; ast: Program | null; code: string }
  | { kind: 'ts'; ast: Program | null; code: string };

// Derive loop-nesting depth from parsed Python/Java/C++ results
function getLoopNestingDepth(
  loops: Array<{ depth: number }>
): number {
  if (loops.length === 0) return 0;
  // Nesting depth = how deep the deepest loop is relative to shallowest
  const minDepth = Math.min(...loops.map((l) => l.depth));
  const maxDepth = Math.max(...loops.map((l) => l.depth));
  return maxDepth - minDepth + 1;
}

function nestingToTimeComplexity(nestingDepth: number): string {
  if (nestingDepth <= 0) return 'O(1)';
  if (nestingDepth === 1) return 'O(n)';
  if (nestingDepth === 2) return 'O(n²)';
  if (nestingDepth === 3) return 'O(n³)';
  return `O(n^${nestingDepth})`;
}

function estimateFromStructured(
  loops: Array<{ depth: number; type: string; hasBreak?: boolean }>,
  hasRecursion: boolean,
  hasMemoization: boolean,
  sortCalls: number,
  hashStructures: number,
  maxNestingDepth: number,
): ComplexityResult {
  const triggers: string[] = [];
  let timeComplexity: string;
  let spaceComplexity = 'O(1)';
  let timeExplanation: string;
  let spaceExplanation = '';
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  // Recursion without memoization — worst case exponential
  if (hasRecursion && !hasMemoization) {
    timeComplexity = 'O(2ⁿ)';
    timeExplanation =
      'Recursive function with no memoization detected. Without caching intermediate results, this likely explores an exponential number of subproblems. Adding @lru_cache (Python), a memo array/HashMap (Java/C++), or converting to bottom-up DP would reduce this to O(n) or O(n²).';
    spaceComplexity = 'O(n)';
    spaceExplanation = 'Recursion stack depth is O(n) in the worst case.';
    triggers.push('recursive call without memoization');
    confidence = 'medium';
  }
  // Recursion WITH memoization — polynomial (typically O(n) or O(n²) depending on state)
  else if (hasRecursion && hasMemoization) {
    timeComplexity = 'O(n)';
    timeExplanation =
      'Recursive function with memoization detected. Each unique subproblem is solved at most once. This is typically O(n) or O(n·k) depending on the number of distinct states.';
    spaceComplexity = 'O(n)';
    spaceExplanation = 'Memoization table and recursion stack both use O(n) space.';
    triggers.push('memoized recursion');
    confidence = 'medium';
  }
  // No recursion: derive from loop nesting
  else if (loops.length > 0) {
    const nestingDepth = getLoopNestingDepth(loops);

    // Sort + single loop = O(n log n)
    if (sortCalls > 0 && nestingDepth <= 1) {
      timeComplexity = 'O(n log n)';
      timeExplanation =
        `Sort operation detected (O(n log n)) combined with a linear pass (O(n)). The sort dominates, giving O(n log n) overall.`;
      triggers.push('sort call', 'linear loop');
    }
    // Nested loops
    else if (nestingDepth >= 2) {
      timeComplexity = nestingToTimeComplexity(nestingDepth);
      const loopCount = `${nestingDepth} nested loop${nestingDepth > 1 ? 's' : ''}`;
      timeExplanation = `${loopCount} detected. Each loop iterates over n elements, giving ${timeComplexity}. `;
      if (hashStructures > 0) {
        timeExplanation +=
          'A hash map/set was also detected — if you move the inner loop lookup into the hash map, you may reduce this to O(n).';
      }
      triggers.push(`${nestingDepth}-level loop nesting`);
      if (nestingDepth >= 3) confidence = 'low';
    }
    // Single loop
    else {
      timeComplexity = 'O(n)';
      timeExplanation = 'Single loop over the input. O(n) time.';
      triggers.push('single loop');
      confidence = 'high';
    }
  }
  // No loops, no recursion: likely O(1) or O(log n) (binary search heuristic)
  else if (sortCalls > 0) {
    timeComplexity = 'O(n log n)';
    timeExplanation = 'Sort operation detected without an outer loop. O(n log n).';
    triggers.push('sort call');
    confidence = 'high';
  } else {
    timeComplexity = 'O(1)';
    timeExplanation =
      'No loops, no recursion, no sort detected. This appears to be constant time. If inputs are bounded or the function operates on fixed-size data, this is accurate; otherwise, verify manually.';
    confidence = 'medium';
  }

  // Space complexity from hash structures
  if (!hasRecursion) {
    if (hashStructures > 0) {
      spaceComplexity = 'O(n)';
      spaceExplanation =
        'Hash map or hash set detected. In the worst case, all n elements are stored, giving O(n) auxiliary space.';
    } else if (sortCalls > 0) {
      spaceComplexity = 'O(log n)';
      spaceExplanation =
        'In-place sort (e.g., quicksort) uses O(log n) stack space. If using a stable sort that allocates a copy, it is O(n).';
    } else {
      spaceComplexity = spaceComplexity === 'O(1)' ? 'O(1)' : spaceComplexity;
      if (!spaceExplanation) {
        spaceExplanation = 'No significant auxiliary data structures detected. Space is likely O(1) (excluding input).';
      }
    }
  }

  return {
    timeComplexity,
    spaceComplexity,
    timeExplanation,
    spaceExplanation,
    triggeringConstructs: triggers,
    confidence,
    isEstimate: true,
  };
}

// ─── JS/TS AST walker ────────────────────────────────────────────────────────

function walkJsAst(ast: Program): {
  loops: Array<{ depth: number; type: string }>;
  hasRecursion: boolean;
  hasMemoization: boolean;
  sortCalls: number;
  hashStructures: number;
  maxDepth: number;
} {
  let maxDepth = 0;
  let currentDepth = 0;
  let sortCalls = 0;
  let hashStructures = 0;
  let hasRecursion = false;
  let hasMemoization = false;
  const loops: Array<{ depth: number; type: string }> = [];
  const currentFnNames: string[] = [];

  function walk(node: any, depth = 0): void {
    if (!node || typeof node !== 'object') return;
    maxDepth = Math.max(maxDepth, depth);

    switch (node.type) {
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
        loops.push({ depth: currentDepth, type: 'for' });
        currentDepth++;
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
        loops.push({ depth: currentDepth, type: 'while' });
        currentDepth++;
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const fnName =
          node.id?.name ??
          (node.type === 'FunctionDeclaration' ? 'anonymous' : 'anonymous');
        currentFnNames.push(fnName);
        break;
      }
      case 'CallExpression': {
        const callee = node.callee;
        // Sort detection
        if (
          callee?.type === 'MemberExpression' &&
          callee.property?.name === 'sort'
        ) {
          sortCalls++;
        }
        // Map/Set construction
        if (
          node.type === 'NewExpression' &&
          ['Map', 'Set'].includes(callee?.name)
        ) {
          hashStructures++;
        }
        // Recursion detection
        if (callee?.name && currentFnNames.includes(callee.name)) {
          hasRecursion = true;
        }
        break;
      }
      case 'NewExpression': {
        if (['Map', 'Set'].includes(node.callee?.name)) {
          hashStructures++;
        }
        break;
      }
      case 'VariableDeclarator': {
        // detect `const memo = {}` or `const dp = []`
        if (/memo|cache|dp/.test(node.id?.name ?? '')) {
          hasMemoization = true;
        }
        // `new Map()` or `{}`
        if (
          node.init?.type === 'ObjectExpression' ||
          node.init?.callee?.name === 'Map'
        ) {
          hashStructures++;
        }
        break;
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'type') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((c) => walk(c, depth + 1));
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, depth + 1);
      }
    }

    // Pop loop depth on exit
    if (
      ['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'].includes(node.type)
    ) {
      currentDepth = Math.max(0, currentDepth - 1);
    }
    if (
      ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)
    ) {
      currentFnNames.pop();
    }
  }

  walk(ast);

  return { loops, hasRecursion, hasMemoization, sortCalls, hashStructures, maxDepth };
}

// ─── Structural fallback (when AST parse fails) ─────────────────────────────

function estimateFromCode(code: string): ComplexityResult {
  const lines = code.split('\n');
  let loopNesting = 0;
  let maxNesting = 0;
  let sortCalls = 0;
  let hashStructures = 0;
  const forPattern = /\b(for|while)\b\s*[\s(]/;
  const sortPattern = /\.sort\s*\(|Arrays\.sort|Collections\.sort|sorted\s*\(|std::sort/;
  const hashPattern = /HashMap|HashSet|Map<|Set<|unordered_map|defaultdict|Counter\b|\bdict\b/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^\s*\/\/|^\s*#/.test(trimmed)) continue;
    if (forPattern.test(trimmed)) {
      loopNesting++;
      maxNesting = Math.max(maxNesting, loopNesting);
    }
    if (/\}/.test(trimmed)) loopNesting = Math.max(0, loopNesting - 1);
    if (sortPattern.test(trimmed)) sortCalls++;
    if (hashPattern.test(trimmed)) hashStructures++;
  }

  // Treat line-based loopNesting as nesting depth (rough)
  const loops = Array.from({ length: maxNesting }, (_, i) => ({ depth: i, type: 'for' }));

  return estimateFromStructured(loops, false, false, sortCalls, hashStructures, maxNesting);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function estimateComplexity(input: ParsedInput): ComplexityResult {
  switch (input.kind) {
    case 'python': {
      const d = input.data;
      return estimateFromStructured(
        d.loops,
        d.hasRecursion,
        d.hasMemoization,
        d.sortCalls,
        d.hashStructures,
        d.maxNestingDepth,
      );
    }
    case 'java': {
      const d = input.data;
      return estimateFromStructured(
        d.loops,
        d.hasRecursion,
        d.hasMemoization,
        d.sortCalls,
        d.hashStructures,
        d.maxNestingDepth,
      );
    }
    case 'cpp': {
      const d = input.data;
      return estimateFromStructured(
        d.loops,
        d.hasRecursion,
        d.hasMemoization,
        d.sortCalls,
        d.hashStructures,
        d.maxNestingDepth,
      );
    }
    case 'js':
    case 'ts': {
      if (!input.ast) {
        // AST parse failed — fall back to structural heuristic
        return estimateFromCode(input.code);
      }
      const jsInfo = walkJsAst(input.ast);
      return estimateFromStructured(
        jsInfo.loops,
        jsInfo.hasRecursion,
        jsInfo.hasMemoization,
        jsInfo.sortCalls,
        jsInfo.hashStructures,
        jsInfo.maxDepth,
      );
    }
  }
}
