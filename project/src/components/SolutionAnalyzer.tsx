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
};

const COMPLEXITY_BADGE_COLOR: Record<string, string> = {
  'O(1)': 'bg-emerald-500/20 text-emerald-400',
  'O(log n)': 'bg-emerald-500/20 text-emerald-400',
  'O(n)': 'bg-emerald-500/20 text-emerald-400',
  'O(n log n)': 'bg-amber-500/20 text-amber-400',
  'O(n²)': 'bg-rose-500/20 text-rose-400',
  'O(n³)': 'bg-rose-500/20 text-rose-400',
  'O(2ⁿ)': 'bg-rose-500/20 text-rose-400',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-emerald-400',
  Medium: 'text-amber-400',
  Hard: 'text-rose-400',
};

const LABEL_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-500/20 text-emerald-400',
  brand: 'bg-indigo-500/20 text-indigo-400',
  amber: 'bg-amber-500/20 text-amber-400',
  slate: 'bg-slate-500/20 text-slate-400',
  rose: 'bg-rose-500/20 text-rose-400',
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
      } catch {}
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
    <div className="space-y-6 animate-fade-in">
      {/* Input area */}
      <div className="rounded-2xl border border-indigo-500/20 bg-white/5 backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="solution-code" className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
            Paste your accepted solution
          </label>
          {code.length > 0 && (
            <span className={`text-xs ${code.length > MAX_CHARS * 0.9 ? 'text-rose-400' : 'text-slate-500'}`}>
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
          className="w-full h-48 bg-black/30 rounded-xl border border-indigo-500/20 px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 resize-y focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          maxLength={MAX_CHARS}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Paste your LeetCode solution code here"
          aria-describedby="analyzer-help"
        />

        <p id="analyzer-help" className="text-xs text-slate-500">
          Your code <strong className="text-slate-400">never leaves your browser</strong> — no API calls, no server processing. Language is auto-detected.
        </p>

        {/* Optional: problem name + language override */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="problem-slug" className="block text-xs text-slate-500 mb-1">
              Problem name / slug <span className="text-slate-600">(optional — improves suggestions)</span>
            </label>
            <input
              id="problem-slug"
              type="text"
              value={problemSlug}
              onChange={(e) => setProblemSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="two-sum"
              className="w-full rounded-xl border border-indigo-500/20 bg-black/20 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="language-override" className="block text-xs text-slate-500 mb-1">
              Language override <span className="text-slate-600">(leave blank for auto-detect)</span>
            </label>
            <select
              id="language-override"
              value={languageOverride ?? ''}
              onChange={(e) => setLanguageOverride((e.target.value as SupportedLanguage) || null)}
              className="w-full rounded-xl border border-indigo-500/20 bg-black/20 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
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
          className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: code.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#374151',
            boxShadow: code.trim() ? '0 0 20px rgba(99, 102, 241, 0.3)' : 'none',
          }}
          aria-label="Analyze solution"
        >
          {state.status === 'analyzing' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing…
            </span>
          ) : 'Analyze Solution'}
        </button>
      </div>

      {/* Error state */}
      {state.status === 'error' && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 animate-fade-in" role="alert">
          <p className="text-sm text-rose-300 font-medium">⚠ {state.error.message}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Header row: detected language + parse note */}
          <div className="flex flex-wrap items-center gap-3">
            {result.detectedLanguage.language && (
              <span className="badge bg-indigo-500/20 text-indigo-400 text-xs px-3 py-1 rounded-full font-mono">
                {LANGUAGE_LABELS[result.detectedLanguage.language]}
                {result.detectedLanguage.requiresConfirmation && ' (?)'}
              </span>
            )}
            {result.parseError && (
              <span className="text-xs text-amber-400">
                ⚠ Parser fallback: {result.parseError.slice(0, 60)}
              </span>
            )}
            <span className="text-xs text-slate-600 ml-auto">
              Analyzed in {result.analysisTimeMs}ms
            </span>
          </div>

          {/* Complexity card */}
          <div className="rounded-2xl border border-indigo-500/20 bg-white/5 backdrop-blur-sm p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Estimated Complexity
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Time</p>
                <span className={`inline-block px-3 py-1.5 rounded-lg text-base font-mono font-bold ${COMPLEXITY_BADGE_COLOR[result.complexity.timeComplexity] ?? 'bg-slate-500/20 text-slate-300'}`}>
                  {result.complexity.timeComplexity}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Space (auxiliary)</p>
                <span className={`inline-block px-3 py-1.5 rounded-lg text-base font-mono font-bold ${COMPLEXITY_BADGE_COLOR[result.complexity.spaceComplexity] ?? 'bg-slate-500/20 text-slate-300'}`}>
                  {result.complexity.spaceComplexity}
                </span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
              <p><strong className="text-slate-200">Time:</strong> {result.complexity.timeExplanation}</p>
              <p><strong className="text-slate-200">Space:</strong> {result.complexity.spaceExplanation}</p>
            </div>
            <p className="text-xs text-slate-600 italic">
              These are estimates based on static analysis — not a formal proof. Edge cases and constant factors may differ.
            </p>
          </div>

          {/* Better approach */}
          {(result.patternMatch.betterApproach || result.patternMatch.genericRedFlags.length > 0) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                💡 Better Approach
              </h3>
              {result.patternMatch.betterApproach && (
                <div>
                  <p className="text-sm font-semibold text-amber-300 mb-1">
                    {result.patternMatch.betterApproach.technique} →{' '}
                    <span className="font-mono">{result.patternMatch.betterApproach.optimalComplexity}</span>
                  </p>
                  <p className="text-sm text-slate-300">{result.patternMatch.betterApproach.explanation}</p>
                </div>
              )}
              {result.patternMatch.genericRedFlags.map((flag, i) => (
                <p key={i} className="text-sm text-slate-300">⚑ {flag}</p>
              ))}
            </div>
          )}

          {/* All good */}
          {result.patternMatch.problemKnown && result.patternMatch.currentComplexityIsOptimal && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-300">
                ✓ Your solution matches the known-optimal approach for this problem.
              </p>
            </div>
          )}

          {/* Similar problems */}
          {result.similarProblems.length > 0 && (
            <div className="rounded-2xl border border-indigo-500/20 bg-white/5 p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                Similar Problems
              </h3>
              <ul className="space-y-2">
                {result.similarProblems.map((p) => (
                  <li key={p.slug} className="flex items-center justify-between gap-3 rounded-lg border border-indigo-500/10 bg-black/20 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <a
                        href={p.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-200 hover:text-indigo-400 transition-colors truncate block"
                      >
                        {p.title}
                      </a>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.listMembership.map((list) => (
                          <span key={list} className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                            {list === 'blind75' ? 'Blind 75' : list === 'neetcode150' ? 'NeetCode 150' : 'Grind 75'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${DIFFICULTY_COLORS[p.difficulty] ?? 'text-slate-400'}`}>
                      {p.difficulty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview label */}
          <div className="rounded-2xl border border-indigo-500/20 bg-white/5 p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Interview Relevance
            </h3>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${LABEL_COLORS[result.interviewLabel.labelColor]}`}>
                {result.interviewLabel.label}
              </span>
            </div>
            <p className="text-sm text-slate-400">{result.interviewLabel.explanation}</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-black/20 p-2.5">
                <p className="text-slate-600 mb-0.5">Difficulty</p>
                <p className={`font-semibold ${DIFFICULTY_COLORS[result.interviewLabel.breakdown.difficulty] ?? 'text-slate-300'}`}>
                  {result.interviewLabel.breakdown.difficulty}
                </p>
              </div>
              <div className="rounded-lg bg-black/20 p-2.5">
                <p className="text-slate-600 mb-0.5">Acceptance</p>
                <p className="font-semibold text-slate-300">
                  {result.interviewLabel.breakdown.acceptanceRate !== null
                    ? `${result.interviewLabel.breakdown.acceptanceRate}%`
                    : 'N/A'}
                </p>
              </div>
              <div className="rounded-lg bg-black/20 p-2.5">
                <p className="text-slate-600 mb-0.5">In lists</p>
                <p className="font-semibold text-slate-300">{result.interviewLabel.breakdown.listCount} / 3</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session batch history */}
      {batchHistory.length > 1 && (
        <details className="rounded-2xl border border-indigo-500/20 bg-white/5">
          <summary className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-indigo-400 cursor-pointer hover:text-indigo-300 transition-colors">
            Session batch ({batchHistory.length} analyses this session)
          </summary>
          <div className="px-5 pb-4">
            <p className="text-xs text-slate-600 mb-3">
              Stored in browser memory only — cleared when you close this tab. Never sent anywhere.
            </p>
            <div className="space-y-2">
              {batchHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-indigo-500/10 bg-black/20 px-3 py-2 text-xs">
                  <span className="font-mono text-slate-400 flex-1 truncate">{entry.problemSlug}</span>
                  <span className="text-slate-500">{LANGUAGE_LABELS[entry.language as SupportedLanguage] ?? entry.language}</span>
                  <span className={`font-mono ${COMPLEXITY_BADGE_COLOR[entry.timeComplexity] ?? 'text-slate-400'}`}>
                    {entry.timeComplexity}
                  </span>
                  {entry.isOptimal === true && <span className="text-emerald-400">✓ Optimal</span>}
                  {entry.isOptimal === false && <span className="text-amber-400">↑ Better exists</span>}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
