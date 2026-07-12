import type { APIRoute } from 'astro';

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,25}$/;

const GQL_QUERY = `
query getUserData($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName starRating }
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
    tagProblemCounts {
      advanced { tagName tagSlug problemsSolved }
      intermediate { tagName tagSlug problemsSolved }
      fundamental { tagName tagSlug problemsSolved }
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount rating globalRanking
  }
  recentAcSubmissionList(username: $username, limit: 20) {
    id title titleSlug
  }
  userCalendar(username: $username, year: 2025) {
    activeYears streak totalActiveDays submissionCalendar
  }
}
`;

// Rate limiter: 10 requests per 60 seconds per IP.
// Backed by the LEETCODE_CACHE KV namespace (prefixed keys) so the limit is
// enforced globally rather than per-isolate. A plain in-memory Map is kept as
// a fallback only for local dev/test environments where no KV binding exists —
// it is NOT relied on in production, where every isolate would otherwise have
// its own independent counter.
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const RATE_LIMIT_KEY_PREFIX = 'ratelimit:profile:';

const fallbackRateLimitMap = new Map<string, number[]>();

function isRateLimitedInMemory(ip: string): boolean {
  const now = Date.now();
  const hits = fallbackRateLimitMap.get(ip) ?? [];
  const recent = hits.filter(t => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  fallbackRateLimitMap.set(ip, recent);
  return false;
}

async function isRateLimited(ip: string, kv: any): Promise<boolean> {
  if (!kv) {
    return isRateLimitedInMemory(ip);
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}${ip}`;
  const now = Date.now();

  try {
    const stored = await kv.get(key);
    const hits: number[] = stored ? JSON.parse(stored) : [];
    const recent = hits.filter((t) => now - t < WINDOW_MS);

    if (recent.length >= RATE_LIMIT) return true;

    recent.push(now);
    // TTL in whole seconds, rounded up, with a small floor to satisfy KV's minimum
    const ttlSeconds = Math.max(Math.ceil(WINDOW_MS / 1000), 60);
    await kv.put(key, JSON.stringify(recent), { expirationTtl: ttlSeconds });
    return false;
  } catch {
    // KV unavailable mid-request — fail open rather than blocking real traffic
    return false;
  }
}

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);

  // Resolve the KV binding up front — used for both rate limiting and profile caching
  let kv: any = null;
  try {
    const { env } = await import('cloudflare:workers');
    kv = env.LEETCODE_CACHE;
  } catch {
    // Non-Cloudflare or test environment
  }

  // IP-based rate limiting (10 req/minute), enforced globally via KV
  const clientIp =
    context.request.headers.get('CF-Connecting-IP') ??
    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '0.0.0.0';
  if (await isRateLimited(clientIp, kv)) {
    return new Response(
      JSON.stringify({ error: 'rate_limit_exceeded', message: "You're checking too fast — please wait a minute before trying again." }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  const username = url.searchParams.get('username') ?? '';

  // Validate username
  if (!USERNAME_RE.test(username)) {
    return new Response(
      JSON.stringify({ error: 'invalid_username' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Deterministic mock endpoints for E2E tests only — never active in production,
  // so a real visitor typing these strings as their LeetCode username still gets
  // a genuine lookup (or a genuine "not found") instead of canned test data.
  const isTestMode = import.meta.env.MODE === 'test';

  if (isTestMode && username === 'mock_notfound') {
    return new Response(
      JSON.stringify({ error: 'user_not_found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (isTestMode && username === 'mock_unavailable') {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (isTestMode && username === 'mock_invalid') {
    return new Response(
      JSON.stringify({ error: 'invalid_username' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (isTestMode && username === 'mock_neetcode') {
    const mockData = {
      matchedUser: {
        username: 'mock_neetcode',
        profile: { realName: 'NeetCode Mocked', starRating: 5 },
        submitStatsGlobal: {
          acSubmissionNum: [
            { difficulty: 'Easy', count: 120 },
            { difficulty: 'Medium', count: 180 },
            { difficulty: 'Hard', count: 50 }
          ]
        },
        tagProblemCounts: {
          advanced: [],
          intermediate: [],
          fundamental: []
        }
      },
      userContestRanking: { attendedContestsCount: 15, rating: 2150, globalRanking: 1200 },
      recentAcSubmissionList: [
        { id: "1", title: "Two Sum", titleSlug: "two-sum" },
        { id: "2", title: "Contains Duplicate", titleSlug: "contains-duplicate" },
        { id: "3", title: "Valid Anagram", titleSlug: "valid-anagram" },
        { id: "4", title: "Valid Parentheses", titleSlug: "valid-parentheses" },
        { id: "5", title: "Best Time to Buy and Sell Stock", titleSlug: "best-time-to-buy-and-sell-stock" }
      ],
      userCalendar: { activeYears: [2025], streak: 12, totalActiveDays: 45, submissionCalendar: '{"1735689600": 3, "1735776000": 5}' }
    };
    return new Response(JSON.stringify(mockData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Check KV cache
  if (kv) {
    try {
      const cached = await kv.get(username);
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
          },
        });
      }
    } catch {
      // KV unavailable — proceed to fetch
    }
  }

  const fetchStart = Date.now();

  let leetcodeResponse: Response;
  try {
    leetcodeResponse = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LeetCodeAnalyzer/1.0 (https://leetcodeanalyzer.com; respectful-use)',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({
        query: GQL_QUERY,
        variables: { username },
      }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const elapsed = Date.now() - fetchStart;
  // Log status and timing only — never log response body
  console.log(`[profile] LeetCode responded: status=${leetcodeResponse.status} elapsed=${elapsed}ms`);

  if (!leetcodeResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try {
    body = await leetcodeResponse.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = body?.data;

  // User not found
  if (!data?.matchedUser) {
    return new Response(
      JSON.stringify({ error: 'user_not_found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const responseData = {
    matchedUser: data.matchedUser,
    userContestRanking: data.userContestRanking ?? null,
    recentAcSubmissionList: data.recentAcSubmissionList ?? [],
    userCalendar: data.userCalendar ?? null,
  };

  const responseJson = JSON.stringify(responseData);

  // Write to KV with 1-hour TTL
  if (kv) {
    try {
      await kv.put(username, responseJson, { expirationTtl: 3600 });
    } catch {
      // KV write failure is non-fatal
    }
  }

  return new Response(responseJson, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
