/**
 * JS/TS parser using acorn (ES2022+) with @babel/parser as fallback for TypeScript.
 * Both are bundled, tree-shakeable, and run fully client-side.
 */

import type { Node, Program } from 'estree';

export interface ParseResult {
  ast: Program | null;
  error: string | null;
  language: 'javascript' | 'typescript';
}

/**
 * Parse JS or TS code into an ESTree-compatible AST.
 * Never executes the code — parse only.
 */
export async function parseJsTs(
  code: string,
  language: 'javascript' | 'typescript',
): Promise<ParseResult> {
  // TypeScript: use @babel/parser
  if (language === 'typescript') {
    try {
      const { parse } = await import('@babel/parser');
      const babelAst = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'decorators-legacy'],
        errorRecovery: true,
      });

      // Convert Babel AST to a shape compatible with our walker
      // Babel's AST is ESTree-compatible at the node level we care about
      return {
        ast: babelAst.program as unknown as Program,
        error: null,
        language: 'typescript',
      };
    } catch (err) {
      return {
        ast: null,
        error: err instanceof Error ? err.message : 'TypeScript parse failed',
        language: 'typescript',
      };
    }
  }

  // JavaScript: use acorn (lighter, faster, ESTree-native)
  try {
    const acorn = await import('acorn');
    const ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'module',
      locations: true,
    }) as Program;

    return { ast, error: null, language: 'javascript' };
  } catch (err) {
    // Acorn failed (e.g., experimental syntax) — fall back to Babel
    try {
      const { parse } = await import('@babel/parser');
      const babelAst = parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
      });
      return {
        ast: babelAst.program as unknown as Program,
        error: null,
        language: 'javascript',
      };
    } catch (fallbackErr) {
      return {
        ast: null,
        error:
          fallbackErr instanceof Error
            ? fallbackErr.message
            : 'JavaScript parse failed',
        language: 'javascript',
      };
    }
  }
}
