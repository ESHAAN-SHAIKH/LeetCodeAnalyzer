/**
 * Python structural heuristic parser.
 * tree-sitter WASM for Python is large (~500KB) and requires WASM loading.
 * For v1 we use a robust structural heuristic approach that handles
 * well-formed LeetCode Python solutions accurately, with clear limitations noted in the UI.
 * 
 * SECURITY: This module NEVER executes the code. Parse only.
 */

export interface PythonParseResult {
  loops: LoopInfo[];
  functions: FunctionInfo[];
  hasRecursion: boolean;
  hasMemoization: boolean;
  sortCalls: number;
  hashStructures: number;
  maxNestingDepth: number;
  parseMethod: 'heuristic';
}

export interface LoopInfo {
  type: 'for' | 'while';
  depth: number;
  line: number;
  hasBreak: boolean;
}

export interface FunctionInfo {
  name: string;
  line: number;
  isRecursive: boolean;
  hasMemoization: boolean;
}

// Match Python indentation level (4 spaces or 1 tab per level)
function getIndentDepth(line: string): number {
  const match = line.match(/^(\s+)/);
  if (!match) return 0;
  const spaces = match[1].replace(/\t/g, '    ').length;
  return Math.floor(spaces / 4);
}

export function parsePython(code: string): PythonParseResult {
  const lines = code.split('\n');
  const loops: LoopInfo[] = [];
  const functions: FunctionInfo[] = [];
  let sortCalls = 0;
  let hashStructures = 0;
  let maxNestingDepth = 0;
  const functionNames: string[] = [];

  // Extract function names first (for recursion detection)
  for (const line of lines) {
    const fnMatch = line.match(/^\s*def\s+(\w+)\s*\(/);
    if (fnMatch) {
      functionNames.push(fnMatch[1]);
    }
  }

  let currentDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const depth = getIndentDepth(line);

    // Detect for/while loops
    if (/^for\s+/.test(trimmed)) {
      currentDepth = depth;
      maxNestingDepth = Math.max(maxNestingDepth, depth);
      const hasBreak = lines.slice(i + 1).some(
        (l) => getIndentDepth(l) > depth && /\bbreak\b/.test(l)
      );
      loops.push({ type: 'for', depth, line: i + 1, hasBreak });
    }
    if (/^while\s+/.test(trimmed)) {
      currentDepth = depth;
      maxNestingDepth = Math.max(maxNestingDepth, depth);
      const hasBreak = lines.slice(i + 1).some(
        (l) => getIndentDepth(l) > depth && /\bbreak\b/.test(l)
      );
      loops.push({ type: 'while', depth, line: i + 1, hasBreak });
    }

    // Detect function definitions
    const fnMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      // Check if this function calls itself (recursion)
      const body = lines.slice(i + 1);
      let isRecursive = false;
      let hasMemo = false;
      for (const bodyLine of body) {
        if (getIndentDepth(bodyLine) <= depth && bodyLine.trim()) break;
        if (new RegExp(`\\b${fnName}\\s*\\(`).test(bodyLine)) isRecursive = true;
        if (/@lru_cache|@cache|functools\.lru_cache|memo\[|dp\[/.test(bodyLine)) hasMemo = true;
      }
      // Also check for decorator on previous line
      if (i > 0 && /@lru_cache|@cache/.test(lines[i - 1])) hasMemo = true;
      functions.push({ name: fnName, line: i + 1, isRecursive, hasMemoization: hasMemo });
    }

    // Detect sort calls
    if (/\.sort\s*\(|sorted\s*\(/.test(trimmed)) sortCalls++;

    // Detect hash structures
    if (/\bdict\s*\(|\bdefaultdict\s*\(|\bCounter\s*\(|\bset\s*\(|\{\}/.test(trimmed)) {
      hashStructures++;
    }
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
