/**
 * C++ structural heuristic parser.
 * Detects loop nesting, recursion, STL usage, and data structures.
 * SECURITY: Never executes the code — static analysis only.
 */

export interface CppParseResult {
  loops: CppLoopInfo[];
  functions: CppFunctionInfo[];
  hasRecursion: boolean;
  hasMemoization: boolean;
  sortCalls: number;
  hashStructures: number;
  maxNestingDepth: number;
  parseMethod: 'heuristic';
}

export interface CppLoopInfo {
  type: 'for' | 'while' | 'range-for';
  depth: number;
  line: number;
  hasBreak: boolean;
}

export interface CppFunctionInfo {
  name: string;
  line: number;
  isRecursive: boolean;
  hasMemoization: boolean;
}

function getBraceDepthAt(lines: string[], lineIdx: number): number {
  let depth = 0;
  for (let i = 0; i < lineIdx; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
  }
  return Math.max(0, depth);
}

export function parseCpp(code: string): CppParseResult {
  const lines = code.split('\n');
  const loops: CppLoopInfo[] = [];
  const functions: CppFunctionInfo[] = [];
  let sortCalls = 0;
  let hashStructures = 0;
  let maxNestingDepth = 0;

  // Collect function names (non-keyword identifiers before '(')
  const fnNames: string[] = [];
  for (const line of lines) {
    const fn = line.match(/\b(\w+)\s*\([^;]*\)\s*\{?\s*$/);
    if (fn && !['if', 'for', 'while', 'switch', 'catch', 'else', 'main'].includes(fn[1])) {
      fnNames.push(fn[1]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const depth = getBraceDepthAt(lines, i);
    maxNestingDepth = Math.max(maxNestingDepth, depth);

    // Range-based for (C++11)
    if (/\bfor\s*\([^;]+:\s*/.test(line)) {
      loops.push({ type: 'range-for', depth, line: i + 1, hasBreak: false });
    } else if (/^\s*for\s*\(/.test(line)) {
      loops.push({ type: 'for', depth, line: i + 1, hasBreak: false });
    }

    if (/^\s*while\s*\(/.test(line)) {
      loops.push({ type: 'while', depth, line: i + 1, hasBreak: false });
    }

    // Function definitions
    const fnMatch = line.match(/\b(\w+)\s*\([^;)]*\)\s*\{/);
    if (fnMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(fnMatch[1])) {
      const fnName = fnMatch[1];
      const body = lines.slice(i + 1);
      let isRecursive = false;
      let hasMemo = false;
      let braceCount = 1;
      for (const bodyLine of body) {
        for (const ch of bodyLine) {
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
        }
        if (braceCount <= 0) break;
        if (new RegExp(`\\b${fnName}\\s*\\(`).test(bodyLine)) isRecursive = true;
        if (/memo|dp\[|unordered_map|cache/.test(bodyLine)) hasMemo = true;
      }
      functions.push({ name: fnName, line: i + 1, isRecursive, hasMemoization: hasMemo });
    }

    // Sort calls
    if (/\bstd::sort\s*\(|\bsort\s*\(/.test(trimmed)) sortCalls++;

    // Hash structures
    if (/unordered_map|unordered_set|map<|set</.test(trimmed)) hashStructures++;
  }

  const hasRecursion = functions.some((f) => f.isRecursive);
  const hasMemoization = functions.some((f) => f.hasMemoization);

  return {
    loops,
    functions,
    hasRecursion,
    hasMemoization,
    sortCalls,
    hashStructures,
    maxNestingDepth,
    parseMethod: 'heuristic',
  };
}
