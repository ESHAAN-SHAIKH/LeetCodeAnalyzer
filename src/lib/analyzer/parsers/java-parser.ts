/**
 * Java structural heuristic parser.
 * Detects loop nesting, recursion, memoization, and data structure usage.
 * SECURITY: Never executes the code — static analysis only.
 */

export interface JavaParseResult {
  loops: JavaLoopInfo[];
  methods: JavaMethodInfo[];
  hasRecursion: boolean;
  hasMemoization: boolean;
  sortCalls: number;
  hashStructures: number;
  maxNestingDepth: number;
  parseMethod: 'heuristic';
}

export interface JavaLoopInfo {
  type: 'for' | 'while' | 'foreach';
  depth: number;
  line: number;
  hasBreak: boolean;
}

export interface JavaMethodInfo {
  name: string;
  line: number;
  isRecursive: boolean;
  hasMemoization: boolean;
}

function countBraceDepth(code: string, upToLine: number): number {
  const lines = code.split('\n').slice(0, upToLine);
  let depth = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return Math.max(0, depth);
}

export function parseJava(code: string): JavaParseResult {
  const lines = code.split('\n');
  const loops: JavaLoopInfo[] = [];
  const methods: JavaMethodInfo[] = [];
  let sortCalls = 0;
  let hashStructures = 0;
  let maxNestingDepth = 0;

  // Collect method names first
  const methodNames: string[] = [];
  for (const line of lines) {
    const mMatch = line.match(/\b(?:public|private|protected|static|void|\w+)\s+(\w+)\s*\([^)]*\)\s*\{?/);
    if (mMatch && !['if', 'for', 'while', 'switch', 'catch', 'try'].includes(mMatch[1])) {
      methodNames.push(mMatch[1]);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    const depth = countBraceDepth(code, i);
    maxNestingDepth = Math.max(maxNestingDepth, depth);

    // for loop (including enhanced for)
    if (/^\s*(for\s*\(|for\s+\w)/.test(line)) {
      const isEnhanced = /for\s*\(.*:/.test(line);
      const remainingLines = lines.slice(i + 1);
      const braceDepthAtLoop = depth;
      const hasBreak = remainingLines.some((l, idx) => {
        const d = countBraceDepth(code, i + 1 + idx);
        return d <= braceDepthAtLoop + 1 && /\bbreak\b/.test(l);
      });
      loops.push({
        type: isEnhanced ? 'foreach' : 'for',
        depth,
        line: i + 1,
        hasBreak,
      });
    }

    // while loop
    if (/^\s*while\s*\(/.test(line)) {
      loops.push({ type: 'while', depth, line: i + 1, hasBreak: false });
    }

    // Method definition (rough heuristic)
    const methodMatch = line.match(
      /\b(?:public|private|protected|static|void|int|long|boolean|String|List|Map)\s+(\w+)\s*\([^)]*\)\s*\{/
    );
    if (methodMatch) {
      const mName = methodMatch[1];
      if (!['if', 'for', 'while', 'switch', 'catch', 'try', 'else'].includes(mName)) {
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
          if (new RegExp(`\\b${mName}\\s*\\(`).test(bodyLine)) isRecursive = true;
          if (/HashMap|memo|dp\[|Map</.test(bodyLine)) hasMemo = true;
        }
        methods.push({ name: mName, line: i + 1, isRecursive, hasMemoization: hasMemo });
      }
    }

    // Sort calls
    if (/Arrays\.sort\s*\(|Collections\.sort\s*\(/.test(trimmed)) sortCalls++;

    // Hash structures
    if (/new\s+HashMap|new\s+HashSet|new\s+LinkedHashMap|Map<|Set</.test(trimmed)) {
      hashStructures++;
    }
  }

  const hasRecursion = methods.some((m) => m.isRecursive);
  const hasMemoization = methods.some((m) => m.hasMemoization);

  return {
    loops,
    methods,
    hasRecursion,
    hasMemoization,
    sortCalls,
    hashStructures,
    maxNestingDepth,
    parseMethod: 'heuristic',
  };
}
