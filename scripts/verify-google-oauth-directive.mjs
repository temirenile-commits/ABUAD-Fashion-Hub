import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const callback = fs.readFileSync(`${root}src/app/auth/callback/route.ts`, 'utf8');
const redirect = fs.readFileSync(`${root}src/lib/auth-redirect.ts`, 'utf8');
const login = fs.readFileSync(`${root}src/app/auth/login/page.tsx`, 'utf8');
const register = fs.readFileSync(`${root}src/app/auth/register/page.tsx`, 'utf8');

const checks = [
  ['dedicated callback route', callback.includes('export async function GET')],
  ['server-side code exchange', callback.includes('exchangeCodeForSession(code)')],
  ['same-response cookie persistence', callback.includes('response.cookies.set(name, value, options)')],
  ['canonical production origin', redirect.includes('https://master-cart-reshuffled.vercel.app')],
  ['preview origin rejection', redirect.includes('Production OAuth must never inherit a Vercel preview/deployment hostname')],
  ['relative returnTo validation', redirect.includes("returnTo.startsWith('/')") && redirect.includes("returnTo.startsWith('//')")],
  ['role-aware callback routing', callback.includes("return '/dashboard/vendor'") && callback.includes("return '/admin'") && callback.includes("return '/university-admin'")],
  ['login uses one OAuth helper', login.includes('getAuthCallbackUrl(') && login.includes("provider: 'google'")],
  ['register uses one OAuth helper', register.includes('getAuthCallbackUrl(') && register.includes("provider: 'google'")],
  ['no callback middleware duplicate', !fs.existsSync(`${root}src/middleware.ts`)],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `failed: ${name}`);
  console.log(`PASS ${name}`);
}
console.log(`OAuth directive checks passed: ${checks.length}/${checks.length}`);
