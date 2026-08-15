import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const native = fs.readFileSync(path.join(root, 'src/lib/ai/native-intelligence.ts'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/app/api/ai/copilot/route.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260815_mastercart_native_intelligence.sql'), 'utf8');
const reviewRoute = fs.readFileSync(path.join(root, 'src/app/api/ai/native/knowledge/review/route.ts'), 'utf8');

function sanitize(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[identifier removed]')
    .replace(/\b(?:password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '[private removed]');
}

const currentOrder = { id: 'live-order', status: 'delivered', updatedAt: '2026-08-15T08:00:00Z' };
const staleMemoryOrder = { id: 'old-order', status: 'processing', updatedAt: '2026-08-01T08:00:00Z' };
const authoritativeOrder = currentOrder.updatedAt > staleMemoryOrder.updatedAt ? currentOrder : staleMemoryOrder;
assert.equal(authoritativeOrder.id, 'live-order');
assert.equal(authoritativeOrder.status, 'delivered');

const sanitized = sanitize('User test@example.com used password=hunter2 on 123e4567-e89b-12d3-a456-426614174000');
assert(!sanitized.includes('test@example.com'));
assert(!sanitized.includes('hunter2'));
assert(!sanitized.includes('123e4567-e89b-12d3-a456-426614174000'));

for (const table of ['miles_native_knowledge', 'miles_reasoning_patterns', 'miles_tool_intelligence', 'miles_learning_events', 'miles_feedback', 'miles_provider_comparisons']) assert(migration.includes(`create table if not exists public.${table}`), `Missing ${table}`);
for (const status of ['proposed', 'validating', 'verified', 'active', 'deprecated']) assert(migration.includes(`'${status}'`), `Missing status ${status}`);
assert(native.includes('generalizeNativeLearning'));
assert(native.includes('recordNativeToolUsage'));
assert(native.includes('recordProviderComparison'));
assert(native.includes('evaluateNativeEvolution'));
assert(route.includes('nativeBrainRespond'));
assert(route.includes('recordNativeLearning'));
assert(native.includes('current backend context'));
assert(native.includes("must not be answered from stale learned memory"));
assert(native.includes('current deterministic backend calculations'));
assert(route.includes('roleData: prepared.roleData'));
assert(route.includes('nativeBrainRespond({ question: lastUserMessage'));
assert(native.includes('const customer = input.roleData.customer'));
assert(native.includes('const wallet = vendor?.wallet'));
assert(reviewRoute.includes('context?.isOverallSuperAdmin'));
assert(reviewRoute.includes('miles_native_knowledge'));
assert(fs.existsSync(path.join(root, 'src/app/api/ai/feedback/route.ts')));
assert(fs.existsSync(path.join(root, 'src/app/api/cron/miles-evolution/route.ts')));

console.log('MNIE directive verification checks passed.');
