/**
 * Language auto-detection via keyword/syntax fingerprinting.
 * No user dropdown required for the four supported languages.
 * Falls back to manual selection only when confidence < 0.7.
 */

export type SupportedLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'cpp';

export interface DetectionResult {
  language: SupportedLanguage | null;
  confidence: number;
  /** true if user should be prompted to confirm the detected language */
  requiresConfirmation: boolean;
}

interface LanguageSignal {
  pattern: RegExp;
  weight: number;
}

const LANGUAGE_SIGNALS: Record<SupportedLanguage, LanguageSignal[]> = {
  python: [
    { pattern: /\bdef\s+\w+\s*\(/m, weight: 3 },
    { pattern: /\bself\b/, weight: 3 },
    { pattern: /^from\s+\w+\s+import\b/m, weight: 2 },
    { pattern: /^import\s+\w+$/m, weight: 1.5 },
    { pattern: /:\s*$\n\s+/m, weight: 2 },          // colon + indent (Python block)
    { pattern: /\bNone\b/, weight: 1.5 },
    { pattern: /\bTrue\b|\bFalse\b/, weight: 1.5 },
    { pattern: /\bprint\s*\(/, weight: 1 },
    { pattern: /\[\s*\]\s*=\s*\[\]|defaultdict|Counter\b/, weight: 2 },
    { pattern: /\brange\s*\(/, weight: 2 },
    { pattern: /\benumerate\s*\(/, weight: 2 },
    { pattern: /\bzip\s*\(/, weight: 1 },
    { pattern: /\bList\[|Dict\[|Optional\[|Tuple\[/, weight: 2 },   // type hints
    { pattern: /->/, weight: 1 },
    { pattern: /#.*$/, weight: 0.5 },
  ],
  java: [
    { pattern: /\bpublic\s+class\b/, weight: 4 },
    { pattern: /\bpublic\b|\bprivate\b|\bprotected\b/, weight: 2 },
    { pattern: /\bSystem\.out\.print/, weight: 4 },
    { pattern: /\bArrayList\b|\bHashMap\b|\bHashSet\b|\bLinkedList\b/, weight: 3 },
    { pattern: /\bvoid\b|\bint\b|\bString\b|\bboolean\b|\bchar\b/, weight: 1.5 },
    { pattern: /\bnew\s+\w+\s*\(/, weight: 2 },
    { pattern: /\bthrows\b|\bthrow\s+new\b/, weight: 3 },
    { pattern: /\bimport\s+java\./, weight: 4 },
    { pattern: /\binterface\b.*\{/, weight: 2 },
    { pattern: /\bextends\b|\bimplements\b/, weight: 2 },
    { pattern: /\bstatic\b/, weight: 1 },
    { pattern: /;$/, weight: 0.5 },                // statement semicolons
  ],
  cpp: [
    { pattern: /#include\s*</, weight: 5 },
    { pattern: /\bstd::/, weight: 4 },
    { pattern: /\bcout\b|\bcin\b/, weight: 4 },
    { pattern: /\bvector<|\bmap<|\bunordered_map<|\bset</, weight: 3 },
    { pattern: /\bint main\s*\(/, weight: 4 },
    { pattern: /\busing namespace std;/, weight: 5 },
    { pattern: /->/, weight: 1 },
    { pattern: /\bnullptr\b/, weight: 3 },
    { pattern: /\bauto\b/, weight: 1 },
    { pattern: /\bpush_back\b|\bemplace_back\b/, weight: 3 },
    { pattern: /\bpair<|\bmake_pair\b/, weight: 3 },
    { pattern: /::/, weight: 2 },
    { pattern: /\bdelete\b|\bnew\b/, weight: 2 },
  ],
  typescript: [
    { pattern: /\binterface\s+\w+\s*\{/, weight: 4 },
    { pattern: /:\s*(string|number|boolean|void|any|never|unknown)\b/, weight: 3 },
    { pattern: /\btype\s+\w+\s*=/, weight: 4 },
    { pattern: /\bEnum\b|enum\s+\w+/, weight: 3 },
    { pattern: /<\w+>/, weight: 2 },                // generics
    { pattern: /\basync\b|\bawait\b/, weight: 1 },
  ],
  javascript: [
    { pattern: /\bconst\b|\blet\b|\bvar\b/, weight: 2 },
    { pattern: /\bfunction\s+\w+\s*\(/, weight: 2 },
    { pattern: /=>\s*[{(]/, weight: 2 },            // arrow function
    { pattern: /\bconsole\.log\b/, weight: 3 },
    { pattern: /\bMap\b|\bSet\b/, weight: 1.5 },
    { pattern: /\bArray\.from\b|\bObject\.\w+/, weight: 2 },
    { pattern: /\bmodule\.exports\b|\bexport\s+(default|const|function)/, weight: 3 },
    { pattern: /\bPromise\b|\basync\b|\bawait\b/, weight: 1.5 },
  ],
};

// TypeScript signals must outscore JavaScript to win
const LANGUAGE_ORDER: SupportedLanguage[] = ['python', 'java', 'cpp', 'typescript', 'javascript'];

export function detectLanguage(code: string): DetectionResult {
  if (!code || code.trim().length < 10) {
    return { language: null, confidence: 0, requiresConfirmation: true };
  }

  const scores: Partial<Record<SupportedLanguage, number>> = {};

  for (const lang of LANGUAGE_ORDER) {
    let score = 0;
    for (const signal of LANGUAGE_SIGNALS[lang]) {
      if (signal.pattern.test(code)) {
        score += signal.weight;
      }
    }
    scores[lang] = score;
  }

  // TypeScript must beat JavaScript by a threshold; otherwise call it JavaScript
  if ((scores.typescript ?? 0) < (scores.javascript ?? 0) + 2) {
    scores.typescript = 0;
  }

  const sorted = LANGUAGE_ORDER.filter((l) => (scores[l] ?? 0) > 0)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));

  if (sorted.length === 0) {
    return { language: null, confidence: 0, requiresConfirmation: true };
  }

  const winner = sorted[0];
  const winnerScore = scores[winner] ?? 0;
  const runnerScore = sorted.length > 1 ? (scores[sorted[1]] ?? 0) : 0;

  // Confidence: ratio of winner margin over winner score
  const margin = winnerScore - runnerScore;
  const confidence = Math.min(1, (margin / Math.max(winnerScore, 1)) * (winnerScore / 5));

  return {
    language: winner,
    confidence,
    requiresConfirmation: confidence < 0.5,
  };
}
