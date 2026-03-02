/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT LIVE API INTEGRATION TEST
 * ════════════════════════════════════════════════════════════
 *
 *  Standalone script that validates all Algonit /api/algo/*
 *  endpoints against the real API using a provided token.
 *
 *  Bypasses all infrastructure (DB, Redis, token store) and
 *  directly tests:
 *    1. HTTP connectivity & authentication
 *    2. Response shape (Zod schema validation)
 *    3. Data presence and field types
 *
 *  Usage:
 *    npx tsx src/tests/algonit.live.test.ts
 *
 *  Environment variables (optional overrides):
 *    ALGONIT_API_URL   — defaults to https://algonit.com/api/algo
 *    ALGONIT_TOKEN     — override the hardcoded test token
 * ════════════════════════════════════════════════════════════
 */

import {
  ProfileResponseSchema,
  CreditsBalanceResponseSchema,
  PostsResponseSchema,
  CampaignListResponseSchema,
  CampaignPerformanceResponseSchema,
  EmailCampaignStatsResponseSchema,
  MarketRadarResponseSchema,
  DashboardSummaryResponseSchema,
  HotLeadsResponseSchema,
  BuyingIntentResponseSchema,
  FollowUpsResponseSchema,
  DealsResponseSchema,
  SocialEngagementResponseSchema,
  LeadsResponseSchema,
  InsightsResponseSchema,
} from '../services/algonit/algonit.schemas.js';
import type { ZodType } from 'zod';

// ─── Configuration ──────────────────────────────────────────

const BASE_URL = process.env.ALGONIT_API_URL || 'https://www.algonit.com/api/algo';
const TOKEN = process.env.ALGONIT_TOKEN || '07e985d731c72122ff757f86798d7c1a93f05fa2c6e80537f4b618ef9f3be58fd64ba0af16946fbb';

// ─── Test Infrastructure ────────────────────────────────────

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  httpStatus?: number;
  schemaValid: boolean;
  schemaErrors?: Array<{ path: string; code: string; message: string }>;
  responsePreview?: string;
  duration_ms: number;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint<T>(
  label: string,
  method: string,
  endpoint: string,
  schema: ZodType<T>,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): Promise<TestResult> {
  const start = Date.now();

  try {
    // Build URL with query params for GET
    let url = `${BASE_URL}${endpoint}`;
    if (method === 'GET' && params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    const duration_ms = Date.now() - start;

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(no body)');
      return {
        endpoint: `${method} ${endpoint}`,
        method,
        status: 'FAIL',
        httpStatus: response.status,
        schemaValid: false,
        duration_ms,
        error: `HTTP ${response.status} ${response.statusText}: ${errorBody.substring(0, 200)}`,
      };
    }

    const data = await response.json();
    const parseResult = schema.safeParse(data);

    const result: TestResult = {
      endpoint: `${method} ${endpoint}`,
      method,
      httpStatus: response.status,
      schemaValid: parseResult.success,
      duration_ms,
      responsePreview: JSON.stringify(data).substring(0, 300),
      status: 'PASS',
    };

    if (!parseResult.success) {
      result.status = 'WARN';
      result.schemaErrors = parseResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      }));
    }

    return result;
  } catch (err) {
    return {
      endpoint: `${method} ${endpoint}`,
      method,
      status: 'FAIL',
      schemaValid: false,
      duration_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Test Suite ──────────────────────────────────────────────

async function runAllTests() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ALGONIT LIVE API INTEGRATION TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Token:    ${TOKEN.substring(0, 8)}...${TOKEN.substring(TOKEN.length - 8)}`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ─── 1. Profile ───────────────────────────────────────
  console.log('Testing GET /me (Profile)...');
  const profileResult = await testEndpoint('Profile', 'GET', '/me', ProfileResponseSchema);
  results.push(profileResult);
  printResult(profileResult);

  // ─── 2. Credits Balance ───────────────────────────────
  console.log('Testing GET /credits (Credits Balance)...');
  const creditsResult = await testEndpoint('Credits', 'GET', '/credits', CreditsBalanceResponseSchema);
  results.push(creditsResult);
  printResult(creditsResult);

  // ─── 3. Posts ─────────────────────────────────────────
  console.log('Testing GET /posts (Posts)...');
  const postsResult = await testEndpoint('Posts', 'GET', '/posts', PostsResponseSchema);
  results.push(postsResult);
  printResult(postsResult);

  // ─── 4. Campaigns ─────────────────────────────────────
  console.log('Testing GET /campaigns (Campaign List)...');
  const campaignsResult = await testEndpoint('Campaigns', 'GET', '/campaigns', CampaignListResponseSchema);
  results.push(campaignsResult);
  printResult(campaignsResult);

  // ─── 5. Campaign Performance ──────────────────────────
  // Try to extract a real campaign ID from the preview using regex (preview is truncated JSON)
  let campaignId = '23'; // fallback — known real campaign ID
  if (campaignsResult.status === 'PASS' || campaignsResult.status === 'WARN') {
    const idMatch = campaignsResult.responsePreview?.match(/"id":(\d+)/);
    if (idMatch) {
      campaignId = idMatch[1];
    }
  }
  console.log(`Testing GET /campaigns/${campaignId}/performance...`);
  const perfResult = await testEndpoint(
    'CampaignPerformance', 'GET', `/campaigns/${campaignId}/performance`,
    CampaignPerformanceResponseSchema,
  );
  results.push(perfResult);
  printResult(perfResult);

  // ─── 6. Email Campaigns ───────────────────────────────
  console.log('Testing GET /email-campaigns...');
  const emailResult = await testEndpoint('EmailCampaigns', 'GET', '/email-campaigns', EmailCampaignStatsResponseSchema);
  results.push(emailResult);
  printResult(emailResult);

  // ─── 7. Market Radar ──────────────────────────────────
  console.log('Testing GET /market-radar/summary...');
  const radarResult = await testEndpoint('MarketRadar', 'GET', '/market-radar/summary', MarketRadarResponseSchema);
  results.push(radarResult);
  printResult(radarResult);

  // ─── 8. Dashboard Summary ─────────────────────────────
  console.log('Testing GET /summary (Dashboard)...');
  const dashResult = await testEndpoint('Dashboard', 'GET', '/summary', DashboardSummaryResponseSchema);
  results.push(dashResult);
  printResult(dashResult);

  // ─── 9. Hot Leads ─────────────────────────────────────
  console.log('Testing GET /hot-leads...');
  const hotLeadsResult = await testEndpoint('HotLeads', 'GET', '/hot-leads', HotLeadsResponseSchema);
  results.push(hotLeadsResult);
  printResult(hotLeadsResult);

  // ─── 10. Buying Intent ────────────────────────────────
  console.log('Testing GET /buying-intent...');
  const intentResult = await testEndpoint('BuyingIntent', 'GET', '/buying-intent', BuyingIntentResponseSchema);
  results.push(intentResult);
  printResult(intentResult);

  // ─── 11. Follow-ups ───────────────────────────────────
  console.log('Testing GET /follow-ups...');
  const followResult = await testEndpoint('FollowUps', 'GET', '/follow-ups', FollowUpsResponseSchema);
  results.push(followResult);
  printResult(followResult);

  // ─── 12. Deals / Pipeline ─────────────────────────────
  console.log('Testing GET /deals...');
  const dealsResult = await testEndpoint('Deals', 'GET', '/deals', DealsResponseSchema);
  results.push(dealsResult);
  printResult(dealsResult);

  // ─── 13. Social Engagement ────────────────────────────
  console.log('Testing GET /engagement...');
  const engResult = await testEndpoint('Engagement', 'GET', '/engagement', SocialEngagementResponseSchema);
  results.push(engResult);
  printResult(engResult);

  // ─── 14. Leads ────────────────────────────────────────
  console.log('Testing GET /leads...');
  const leadsResult = await testEndpoint('Leads', 'GET', '/leads', LeadsResponseSchema);
  results.push(leadsResult);
  printResult(leadsResult);

  // ─── 15. Insights (NEW) ───────────────────────────────
  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`Testing GET /insights (${dateFrom} to ${dateTo})...`);
  const insightsResult = await testEndpoint(
    'Insights', 'GET', '/insights', InsightsResponseSchema,
    { date_from: dateFrom, date_to: dateTo },
  );
  results.push(insightsResult);
  printResult(insightsResult);

  // ─── 15b. Insights with platform filter ───────────────
  console.log('Testing GET /insights?platform=instagram...');
  const insightsIgResult = await testEndpoint(
    'Insights (Instagram)', 'GET', '/insights', InsightsResponseSchema,
    { date_from: dateFrom, date_to: dateTo, platform: 'instagram' },
  );
  results.push(insightsIgResult);
  printResult(insightsIgResult);

  // ─── Summary ──────────────────────────────────────────
  printSummary();
}

// ─── Output Formatting ──────────────────────────────────────

function printResult(r: TestResult) {
  const icon = r.status === 'PASS' ? 'PASS' : r.status === 'WARN' ? 'WARN' : 'FAIL';
  const statusColor = r.status === 'PASS' ? '\x1b[32m' : r.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`  ${statusColor}[${icon}]${reset} ${r.endpoint} (${r.duration_ms}ms) HTTP:${r.httpStatus || 'N/A'} Schema:${r.schemaValid ? 'OK' : 'MISMATCH'}`);

  if (r.error) {
    console.log(`         Error: ${r.error}`);
  }

  if (r.schemaErrors && r.schemaErrors.length > 0) {
    console.log('         Schema issues:');
    for (const err of r.schemaErrors) {
      console.log(`           - ${err.path || '(root)'}: ${err.message} [${err.code}]`);
    }
  }

  if (r.status === 'PASS' && r.responsePreview) {
    console.log(`         Preview: ${r.responsePreview.substring(0, 150)}...`);
  }

  console.log('');
}

function printSummary() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════');

  const pass = results.filter((r) => r.status === 'PASS').length;
  const warn = results.filter((r) => r.status === 'WARN').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration_ms, 0);

  console.log(`  Total:    ${total} endpoints tested`);
  console.log(`  \x1b[32mPassed:\x1b[0m  ${pass}`);
  console.log(`  \x1b[33mWarning:\x1b[0m ${warn} (HTTP OK but schema mismatch — needs fix)`);
  console.log(`  \x1b[31mFailed:\x1b[0m  ${fail}`);
  console.log(`  Time:     ${totalTime}ms total`);
  console.log('');

  if (warn > 0) {
    console.log('  Schema mismatches found — the real API returns a different shape');
    console.log('  than our Zod schemas expect. Review WARN entries above and update');
    console.log('  algonit.schemas.ts + algonit.types.ts to match the real API.');
    console.log('');
  }

  if (fail > 0) {
    console.log('  Failed endpoints could not be reached or returned HTTP errors.');
    console.log('  Check token validity, API URL, and endpoint availability.');
    console.log('');
  }

  if (pass === total) {
    console.log('  All endpoints passed with valid schemas!');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════');
}

// ─── Run ─────────────────────────────────────────────────────

runAllTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
