import type { APIRoute } from 'astro';

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,25}$/;

const GQL_QUERY = `
query getUserData($username: String!, $year: Int!) {
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
  userCalendar(username: $username, year: $year) {
    activeYears streak totalActiveDays submissionCalendar
  }
}
`;

// Simple in-memory rate limiter: 10 requests per 60 seconds per IP
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = rateLimitMap.get(ip) ?? [];
  const recent = hits.filter(t => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);

  // IP-based rate limiting (10 req/minute)
  const clientIp =
    context.request.headers.get('CF-Connecting-IP') ??
    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '0.0.0.0';
  if (isRateLimited(clientIp)) {
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

  // Deterministic mock endpoints for E2E tests
  if (username === 'mock_notfound') {
    return new Response(
      JSON.stringify({ error: 'user_not_found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (username === 'mock_unavailable') {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (username === 'mock_invalid') {
    return new Response(
      JSON.stringify({ error: 'invalid_username' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (username === 'mock_neetcode') {
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
  let kv: any = null;
  try {
    const { env } = await import('cloudflare:workers');
    kv = env.LEETCODE_CACHE;
  } catch {
    // Non-Cloudflare or test environment
  }

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
        variables: { username, year: new Date().getFullYear() },
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
