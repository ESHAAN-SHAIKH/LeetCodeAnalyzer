/**
 * Solution Analyzer — main entry point.
 * 
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. Never eval(), new Function(), or execute user code in any form.
 * 2. Never make a network request with user code.
 * 3. Hard 3-second timeout on the entire analysis pass.
 * 4. All parsing and analysis happens client-side in the browser.
 * 5. Code never leaves the user's machine.
 */

import { detectLanguage } from './detect-language';
import type { SupportedLanguage, DetectionResult } from './detect-language';
import { estimateComplexity } from './complexity-estimator';
import type { ComplexityResult } from './complexity-estimator';
import { matchPattern } from './pattern-matcher';
import type { PatternMatchResult } from './pattern-matcher';
import { findSimilarProblems } from './similar-problems';
import { computeInterviewLabel } from './interview-label';
import type { InterviewLabelResult } from './interview-label';

export interface AnalysisInput {
  code: string;
  problemSlug?: string | null;
  languageOverride?: SupportedLanguage | null;
}

export interface AnalysisResult {
  detectedLanguage: DetectionResult;
  complexity: ComplexityResult;
  patternMatch: PatternMatchResult;
  similarProblems: ReturnType<typeof findSimilarProblems>;
  interviewLabel: InterviewLabelResult;
  analysisTimeMs: number;
  parseError: string | null;
}

export interface AnalysisError {
  error: true;
  message: string;
  code: 'TIMEOUT' | 'INPUT_TOO_LARGE' | 'LANGUAGE_UNSUPPORTED' | 'PARSE_FAILED';
}

const MAX_CODE_LENGTH = 20_000;
const TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('TIMEOUT')),
      timeoutMs,
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function parseAndAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const start = performance.now();

  // Input validation
  if (input.code.length > MAX_CODE_LENGTH) {
    throw Object.assign(new Error('Input too large'), { code: 'INPUT_TOO_LARGE' });
  }

  // Language detection
  const detectedLanguage = input.languageOverride
    ? { language: input.languageOverride, confidence: 1, requiresConfirmation: false }
    : detectLanguage(input.code);

  const lang = detectedLanguage.language;

  let complexityInput: Parameters<typeof estimateComplexity>[0];
  let parseError: string | null = null;

  if (!lang) {
    // Cannot determine language — fallback to raw code heuristics
    complexityInput = { kind: 'js' as const, ast: null, code: input.code };
  } else if (lang === 'python') {
    const { parsePython } = await import('./parsers/python-parser');
    const data = parsePython(input.code);
    complexityInput = { kind: 'python', data };

  } else if (lang === 'java') {
    const { parseJava } = await import('./parsers/java-parser');
    const data = parseJava(input.code);
    complexityInput = { kind: 'java', data };

  } else if (lang === 'cpp') {
    const { parseCpp } = await import('./parsers/cpp-parser');
    const data = parseCpp(input.code);
    complexityInput = { kind: 'cpp', data };

  } else if (lang === 'javascript' || lang === 'typescript') {
    const { parseJsTs } = await import('./parsers/js-parser');
    const result = await parseJsTs(input.code, lang);
    if (result.error) parseError = result.error;
    complexityInput = {
      kind: (lang === 'typescript' ? 'ts' : 'js') as 'js' | 'ts',
      ast: result.ast,
      code: input.code,
    };

  } else {
    // Unsupported language — this shouldn't happen given the type system, but be safe
    throw Object.assign(new Error('Language not supported'), { code: 'LANGUAGE_UNSUPPORTED' });
  }

  const complexity = estimateComplexity(complexityInput);

  const patternMatch = matchPattern(
    input.problemSlug,
    complexity.timeComplexity,
    complexity.triggeringConstructs,
    0, // hashStructures is embedded in triggeringConstructs already
  );

  const similarProblems = findSimilarProblems(
    input.problemSlug,
    complexity.triggeringConstructs,
    5,
  );

  const interviewLabel = computeInterviewLabel(input.problemSlug);

  return {
    detectedLanguage,
    complexity,
    patternMatch,
    similarProblems,
    interviewLabel,
    analysisTimeMs: Math.round(performance.now() - start),
    parseError,
  };
}

/**
 * Analyze a pasted solution.
 * 
 * Security guarantees:
 * - No eval(), Function(), or code execution
 * - No network requests
 * - 3-second hard timeout
 * - Input capped at 20,000 characters
 */
export async function analyze(input: AnalysisInput): Promise<AnalysisResult | AnalysisError> {
  // Validate input size first (synchronous, no timeout needed)
  if (input.code.length > MAX_CODE_LENGTH) {
    return {
      error: true,
      message: `Code is too long (${input.code.length.toLocaleString()} characters). Maximum is ${MAX_CODE_LENGTH.toLocaleString()} characters.`,
      code: 'INPUT_TOO_LARGE',
    };
  }

  try {
    const result = await withTimeout(parseAndAnalyze(input), TIMEOUT_MS);
    return result;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'TIMEOUT') {
        return {
          error: true,
          message: 'Analysis timed out (3s limit). Try a shorter snippet.',
          code: 'TIMEOUT',
        };
      }
      const code = (err as any).code as AnalysisError['code'] | undefined;
      if (code === 'LANGUAGE_UNSUPPORTED') {
        return {
          error: true,
          message: 'Language not supported. LeetCodeAnalyzer supports Python, JavaScript, TypeScript, Java, and C++.',
          code: 'LANGUAGE_UNSUPPORTED',
        };
      }
    }
    return {
      error: true,
      message: 'Could not analyze this snippet. Try a different code sample.',
      code: 'PARSE_FAILED',
    };
  }
}
