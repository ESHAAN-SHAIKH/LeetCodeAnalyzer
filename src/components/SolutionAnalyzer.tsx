/**
 * SolutionAnalyzer React component — runs 100% client-side.
 * 
 * SECURITY: No eval(), no Function(), no network call for analysis.
 * Code never leaves the browser. All analysis is local.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AnalysisResult, AnalysisError } from '../lib/analyzer/index';
import type { SupportedLanguage } from '../lib/analyzer/detect-language';

type AnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; error: AnalysisError };

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  cpp: 'C++',
};const COMPLEXITY_BADGE_COLOR: Record<string, string> = {
  'O(1)': 'bg-optimal/10 text-optimal border border-optimal/20',
  'O(log n)': 'bg-optimal/10 text-optimal border border-optimal/20',
  'O(n)': 'bg-optimal/10 text-optimal border border-optimal/20',
  'O(n log n)': 'bg-signal/10 text-signal border border-signal/20',
  'O(n²)': 'bg-danger/10 text-danger border border-danger/20',
  'O(n³)': 'bg-danger/10 text-danger border border-danger/20',
  'O(2ⁿ)': 'bg-danger/10 text-danger border border-danger/20',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-optimal',
  Medium: 'text-signal',
  Hard: 'text-danger',
};

const LABEL_COLORS: Record<string, string> = {
  emerald: 'bg-optimal/10 text-optimal border border-optimal/20',
  brand: 'bg-signal/15 text-signal border border-signal/20',
  amber: 'bg-signal/10 text-signal border border-signal/20',
  slate: 'bg-surface-700 text-ink_text-muted border border-surface-600',
  rose: 'bg-danger/10 text-danger border border-danger/20',
};

interface BatchEntry {
  id: string;
  problemSlug: string;
  language: string;
  timeComplexity: string;
  spaceComplexity: string;
  isOptimal: boolean | null;
  timestamp: number;
}

export default function SolutionAnalyzer() {
  const [code, setCode] = useState('');
  const [problemSlug, setProblemSlug] = useState('');
  const [languageOverride, setLanguageOverride] = useState<SupportedLanguage | null>(null);
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const [batchHistory, setBatchHistory] = useState<BatchEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 20_000;

  // Load batch history from sessionStorage (not persisted across sessions)
  useEffect(() => {
    const stored = sessionStorage.getItem('lca_batch');
    if (stored) {
      try {
        setBatchHistory(JSON.parse(stored));
      } catch {
        // Corrupt or unreadable sessionStorage entry — ignore and start with empty history
      }
    }
  }, []);

  const saveBatch = useCallback((entries: BatchEntry[]) => {
    sessionStorage.setItem('lca_batch', JSON.stringify(entries));
    setBatchHistory(entries);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;

    setState({ status: 'analyzing' });

    try {
      // Lazy-load the analyzer (never bundled with homepage)
      const { analyze } = await import('../lib/analyzer/index');

      const result = await analyze({
        code,
        problemSlug: problemSlug || null,
        languageOverride,
      });

      if ('error' in result && result.error) {
        setState({ status: 'error', error: result });
        return;
      }

      const analysisResult = result as AnalysisResult;
      setState({ status: 'done', result: analysisResult });

      // Add to session batch
      const entry: BatchEntry = {
        id: crypto.randomUUID(),
        problemSlug: problemSlug || 'Unknown',
        language: analysisResult.detectedLanguage.language ?? 'unknown',
        timeComplexity: analysisResult.complexity.timeComplexity,
        spaceComplexity: analysisResult.complexity.spaceComplexity,
        isOptimal: analysisResult.patternMatch.currentComplexityIsOptimal,
        timestamp: Date.now(),
      };
      saveBatch([entry, ...batchHistory].slice(0, 20));

    } catch (err) {
      setState({
        status: 'error',
        error: {
          error: true,
          message: 'An unexpected error occurred. Please try again.',
          code: 'PARSE_FAILED',
        },
      });
    }
  }, [code, problemSlug, languageOverride, batchHistory, saveBatch]);

  const result = state.status === 'done' ? state.result : null;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Input area */}
      <div className="rounded-xl border border-surface-600 bg-surface-800/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="solution-code" className="text-xs font-semibold uppercase tracking-widest text-signal font-sans">
            Paste your accepted solution
          </label>
          {code.length > 0 && (
            <span className={`text-xs font-mono ${code.length > MAX_CHARS * 0.9 ? 'text-danger' : 'text-ink_text-muted'}`}>
              {code.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          )}
        </div>

        <textarea
          id="solution-code"
          ref={textareaRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={'# Paste your LeetCode solution here\ndef twoSum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        if target - num in seen:\n            return [seen[target - num], i]\n        seen[num] = i'}
          className="w-full h-48 bg-surface-900 rounded-lg border border-surface-600 px-4 py-3 text-sm font-mono text-ink_text placeholder-ink_text-muted/40 resize-y focus:outline-none focus:border-signal/60 focus:ring-1 focus:ring-signal/30 transition-all"
          maxLength={MAX_CHARS}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Paste your LeetCode solution code here"
          aria-describedby="analyzer-help"
        />

        <p id="analyzer-help" className="text-xs text-ink_text-muted">
          Your code <strong className="text-ink_text-secondary">never leaves your browser</strong> — no API calls, no server processing. Language is auto-detected.
        </p>

        {/* Optional: problem name + language override */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="problem-slug" className="block text-xs text-ink_text-muted mb-1">
              Problem name / slug <span className="text-ink_text-muted/60">(optional — improves suggestions)</span>
            </label>
            <input
              id="problem-slug"
              type="text"
              value={problemSlug}
              onChange={(e) => setProblemSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="two-sum"
              className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-ink_text placeholder-ink_text-muted/40 focus:outline-none focus:border-signal/60 focus:ring-1 focus:ring-signal/30 transition-all"
            />
          </div>
          <div>
            <label htmlFor="language-override" className="block text-xs text-ink_text-muted mb-1">
              Language override <span className="text-ink_text-muted/60">(leave blank for auto-detect)</span>
            </label>
            <select
              id="language-override"
              value={languageOverride ?? ''}
              onChange={(e) => setLanguageOverride((e.target.value as SupportedLanguage) || null)}
              className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-ink_text focus:outline-none focus:border-signal/60 focus:ring-1 focus:ring-signal/30 transition-all"
            >
              <option value="">Auto-detect</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!code.trim() || state.status === 'analyzing'}
          className="w-full py-3 px-6 rounded-lg font-sans font-semibold text-sm text-ink bg-signal hover:bg-signal-soft transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Analyze solution"
        >
          {state.status === 'analyzing' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing…
            </span>
          ) : 'Analyze Solution'}
        </button>
      </div>

      {/* Error state */}
      {state.status === 'error' && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-5 animate-fade-in font-sans" role="alert">
          <p className="text-sm text-danger font-medium">⚠ {state.error.message}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Header row: detected language + parse note */}
          <div className="flex flex-wrap items-center gap-3">
            {result.detectedLanguage.language && (
              <span className="badge bg-signal/15 text-signal border border-signal/20 text-xs px-3 py-1 rounded font-mono">
                {LANGUAGE_LABELS[result.detectedLanguage.language]}
                {result.detectedLanguage.requiresConfirmation && ' (?)'}
              </span>
            )}
            {result.parseError && (
              <span className="text-xs text-signal font-mono">
                ⚠ Parser fallback: {result.parseError.slice(0, 60)}
              </span>
            )}
            <span className="text-xs text-ink_text-muted ml-auto font-mono">
              Analyzed in {result.analysisTimeMs}ms
            </span>
          </div>

          {/* Complexity card */}
          <div className="rounded-xl border border-surface-600 bg-surface-800/40 p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-signal font-display">
              Estimated Complexity
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-ink_text-muted mb-1">Time</p>
                <span className={`inline-block px-3 py-1.5 rounded text-base font-mono font-bold ${COMPLEXITY_BADGE_COLOR[result.complexity.timeComplexity] ?? 'bg-surface-700 border border-surface-600 text-ink_text-secondary'}`}>
                  {result.complexity.timeComplexity}
                </span>
              </div>
              <div>
                <p className="text-xs text-ink_text-muted mb-1">Space (auxiliary)</p>
                <span className={`inline-block px-3 py-1.5 rounded text-base font-mono font-bold ${COMPLEXITY_BADGE_COLOR[result.complexity.spaceComplexity] ?? 'bg-surface-700 border border-surface-600 text-ink_text-secondary'}`}>
                  {result.complexity.spaceComplexity}
                </span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-ink_text-secondary leading-relaxed font-sans">
              <p><strong className="text-ink_text">Time:</strong> {result.complexity.timeExplanation}</p>
              <p><strong className="text-ink_text">Space:</strong> {result.complexity.spaceExplanation}</p>
            </div>
            <p className="text-xs text-ink_text-muted italic">
              These are estimates based on static analysis — not a formal proof. Edge cases and constant factors may differ.
            </p>
          </div>

          {/* Better approach */}
          {(result.patternMatch.betterApproach || result.patternMatch.genericRedFlags.length > 0) && (
            <div className="rounded-xl border border-signal/40 bg-surface-800/40 p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-signal font-display">
                💡 Better Approach
              </h3>
              {result.patternMatch.betterApproach && (
                <div>
                  <p className="text-sm font-semibold text-signal mb-1">
                    {result.patternMatch.betterApproach.technique} →{' '}
                    <span className="font-mono">{result.patternMatch.betterApproach.optimalComplexity}</span>
                  </p>
                  <p className="text-sm text-ink_text-secondary">{result.patternMatch.betterApproach.explanation}</p>
                </div>
              )}
              {result.patternMatch.genericRedFlags.map((flag, i) => (
                <p key={i} className="text-sm text-ink_text-secondary">⚑ {flag}</p>
              ))}
            </div>
          )}

          {/* All good */}
          {result.patternMatch.problemKnown && result.patternMatch.currentComplexityIsOptimal && (
            <div className="rounded-xl border border-optimal/40 bg-optimal/5 p-4">
              <p className="text-sm text-optimal font-medium">
                ✓ Your solution matches the known-optimal approach for this problem.
              </p>
            </div>
          )}

          {/* Similar problems */}
          {result.similarProblems.length > 0 && (
            <div className="rounded-xl border border-surface-600 bg-surface-800/40 p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-signal font-display">
                Similar Problems
              </h3>
              <ul className="space-y-2">
                {result.similarProblems.map((p) => (
                  <li key={p.slug} className="flex items-center justify-between gap-3 rounded-lg border border-surface-650 bg-surface-900/60 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <a
                        href={p.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-ink_text hover:text-signal transition-colors truncate block"
                      >
                        {p.title}
                      </a>
                      <div className="flex flex-wrap gap-1 mt-1 font-mono">
                        {p.listMembership.map((list) => (
                          <span key={list} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-ink_text-muted border border-surface-600">
                            {list === 'blind75' ? 'Blind 75' : list === 'neetcode150' ? 'NeetCode 150' : 'Grind 75'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 font-mono ${DIFFICULTY_COLORS[p.difficulty] ?? 'text-ink_text-muted'}`}>
                      {p.difficulty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview label */}
          <div className="rounded-xl border border-surface-600 bg-surface-800/40 p-5 space-y-3 font-sans">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-signal font-display">
              Interview Relevance
            </h3>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${LABEL_COLORS[result.interviewLabel.labelColor]}`}>
                {result.interviewLabel.label}
              </span>
            </div>
            <p className="text-sm text-ink_text-secondary">{result.interviewLabel.explanation}</p>
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="rounded-lg bg-surface-900/50 border border-surface-650 p-2.5">
                <p className="text-ink_text-muted mb-0.5 font-sans">Difficulty</p>
                <p className={`font-semibold ${DIFFICULTY_COLORS[result.interviewLabel.breakdown.difficulty] ?? 'text-ink_text-secondary'}`}>
                  {result.interviewLabel.breakdown.difficulty}
                </p>
              </div>
              <div className="rounded-lg bg-surface-900/50 border border-surface-650 p-2.5">
                <p className="text-ink_text-muted mb-0.5 font-sans">Acceptance</p>
                <p className="font-semibold text-ink_text-secondary">
                  {result.interviewLabel.breakdown.acceptanceRate !== null
                     ? `${result.interviewLabel.breakdown.acceptanceRate}%`
                     : 'N/A'}
                </p>
              </div>
              <div className="rounded-lg bg-surface-900/50 border border-surface-650 p-2.5">
                <p className="text-ink_text-muted mb-0.5 font-sans">In lists</p>
                <p className="font-semibold text-ink_text-secondary">{result.interviewLabel.breakdown.listCount} / 3</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session batch history */}
      {batchHistory.length > 1 && (
        <details className="rounded-xl border border-surface-600 bg-surface-800/40">
          <summary className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-signal hover:text-signal-soft cursor-pointer transition-colors font-sans select-none">
            Session batch ({batchHistory.length} analyses this session)
          </summary>
          <div className="px-5 pb-4">
            <p className="text-xs text-ink_text-muted mb-3 font-sans">
              Stored in browser memory only — cleared when you close this tab. Never sent anywhere.
            </p>
            <div className="space-y-2">
              {batchHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-surface-650 bg-surface-900/60 px-3 py-2 text-xs font-mono">
                  <span className="text-ink_text-secondary flex-1 truncate">{entry.problemSlug}</span>
                  <span className="text-ink_text-muted font-sans">{LANGUAGE_LABELS[entry.language as SupportedLanguage] ?? entry.language}</span>
                  <span className={`font-mono ${COMPLEXITY_BADGE_COLOR[entry.timeComplexity] ? 'text-signal' : 'text-ink_text-muted'}`}>
                    {entry.timeComplexity}
                  </span>
                  {entry.isOptimal === true && <span className="text-optimal">✓ Optimal</span>}
                  {entry.isOptimal === false && <span className="text-signal">↑ Better exists</span>}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
