import type { APIRoute } from 'astro';

const SESSION_GQL_QUERY = `
query getSubmissionStats {
  submissionList(offset: 0, limit: 40, questionSlug: "") {
    submissions {
      statusDisplay
      lang
      runtime
      memory
      question { titleSlug topicTags { name } }
    }
  }
}
`;

export const POST: APIRoute = async (context) => {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'invalid_body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const cookie: unknown = body?.cookie;

  // Validate cookie: non-empty string, max 2000 chars — never log value
  if (
    typeof cookie !== 'string' ||
    cookie.trim().length === 0 ||
    cookie.length > 2000
  ) {
    return new Response(
      JSON.stringify({ error: 'invalid_cookie_format' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Mock cookie handlers for E2E tests
  if (cookie === 'mock_invalid_cookie') {
    return new Response(
      JSON.stringify({ error: 'auth_failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (cookie === 'mock_valid_cookie') {
    return new Response(
      JSON.stringify({
        topTopics: [
          { topic: 'Array', count: 12 },
          { topic: 'Hash Table', count: 8 },
          { topic: 'String', count: 5 }
        ],
        languageMix: [
          { lang: 'python3', count: 18 },
          { lang: 'javascript', count: 7 }
        ],
        statusBreakdown: {
          'Accepted': 20,
          'Time Limit Exceeded': 3,
          'Wrong Answer': 2
        },
        avgRuntimeMs: 45,
        submissionCount: 25,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let leetcodeResponse: Response;
  try {
    leetcodeResponse = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'LeetCodeAnalyzer/1.0 (https://leetcodeanalyzer.com; respectful-use)',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({ query: SESSION_GQL_QUERY }),
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Auth failure detection
  if (leetcodeResponse.status === 401 || leetcodeResponse.status === 403) {
    return new Response(
      JSON.stringify({ error: 'auth_failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!leetcodeResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let data: any;
  try {
    const raw = await leetcodeResponse.json();
    data = raw?.data;
  } catch {
    return new Response(
      JSON.stringify({ error: 'leetcode_unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check for auth rejection in GraphQL response
  if (!data || data.errors) {
    return new Response(
      JSON.stringify({ error: 'auth_failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Aggregate the submission data — never return per-submission code
  const submissions: any[] = data?.submissionList?.submissions ?? [];

  // Language distribution
  const langCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const runtimes: number[] = [];

  for (const sub of submissions) {
    const lang = sub.lang ?? 'unknown';
    langCounts[lang] = (langCounts[lang] ?? 0) + 1;

    const status = sub.statusDisplay ?? 'Unknown';
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    for (const tag of sub.question?.topicTags ?? []) {
      tagCounts[tag.name] = (tagCounts[tag.name] ?? 0) + 1;
    }

    const rt = parseInt(sub.runtime ?? '', 10);
    if (!isNaN(rt)) runtimes.push(rt);
  }

  const topTopics = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  const languageMix = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({ lang, count }));

  const avgRuntime = runtimes.length
    ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length)
    : null;

  // Cookie is used above and immediately goes out of scope — never written anywhere
  return new Response(
    JSON.stringify({
      topTopics,
      languageMix,
      statusBreakdown: statusCounts,
      avgRuntimeMs: avgRuntime,
      submissionCount: submissions.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
