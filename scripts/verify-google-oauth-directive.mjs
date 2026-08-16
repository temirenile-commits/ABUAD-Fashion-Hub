import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const callback = fs.readFileSync(`${root}src/app/auth/callback/route.ts`, 'utf8');
const redirect = fs.readFileSync(`${root}src/lib/auth-redirect.ts`, 'utf8');
const siteUrl = fs.readFileSync(`${root}src/lib/site-url.ts`, 'utf8');
const browserClient = fs.readFileSync(`${root}src/lib/supabase.ts`, 'utf8');
const middleware = fs.readFileSync(`${root}src/middleware.ts`, 'utf8');
const login = fs.readFileSync(`${root}src/app/auth/login/page.tsx`, 'utf8');
const register = fs.readFileSync(`${root}src/app/auth/register/page.tsx`, 'utf8');
const forgotPassword = fs.readFileSync(`${root}src/app/auth/forgot-password/page.tsx`, 'utf8');

const sourceFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
  }
}
walk(`${root}src`);
const source = sourceFiles.map((path) => fs.readFileSync(path, 'utf8')).join('\n');

const checks = [
  ['single Google OAuth initiation surface', (source.match(/signInWithOAuth\(/g) || []).length === 2],
  ['single callback code exchange', (source.match(/exchangeCodeForSession\(/g) || []).length === 1],
  ['browser client uses SSR PKCE', browserClient.includes("import { createBrowserClient } from '@supabase/ssr'") && browserClient.includes("flowType: 'pkce'")],
  ['browser client persists auth state', browserClient.includes('persistSession: true') && browserClient.includes('autoRefreshToken: true')],
  ['browser does not auto-exchange callback URL', browserClient.includes('detectSessionInUrl: false')],
  ['canonical production host', siteUrl.includes('https://master-cart-reshuffled.vercel.app') && redirect.includes('https://master-cart-reshuffled.vercel.app')],
  ['preview host cannot override production OAuth', redirect.includes('Production OAuth must never inherit a Vercel preview/deployment hostname')],
  ['safe relative returnTo', redirect.includes("returnTo.startsWith('/')") && redirect.includes("returnTo.startsWith('//')")],
  ['old-host callback is discarded', middleware.includes("pathname === '/auth/callback'") && middleware.includes('oauth_domain_mismatch')],
  ['role-aware callback routing', callback.includes("return '/dashboard/vendor'") && callback.includes("return '/admin'") && callback.includes("return '/university-admin'")],
  ['callback exchanges once and writes same response cookies', callback.includes('exchangeCodeForSession(code)') && callback.includes('response.cookies.set(name, value, options)')],
  ['callback is private and non-cacheable', callback.includes("Cache-Control', 'private, no-store, max-age=0")],
  ['password recovery uses canonical origin', forgotPassword.includes('getCanonicalSiteUrl()')],
  ['login has one-click lock', login.includes('setLoading(true)') && login.includes('disabled={loading}')],
  ['registration has one-click lock', register.includes('setLoading(true)') && register.includes('disabled={loading}')],
  ['no obsolete auth-helper implementation', !source.includes('@supabase/auth-helpers')],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `failed: ${name}`);
  console.log(`PASS ${name}`);
}
console.log(`OAuth directive checks passed: ${checks.length}/${checks.length}`);
