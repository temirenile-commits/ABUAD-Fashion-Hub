import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['single orchestration facade', 'src/lib/ai/miles-engine.ts', ['retrieveMiles', 'analyzeMilesRequest', 'proposeMilesAct']],
  ['central search engine', 'src/lib/ai/search-engine.ts', ['searchMiles', 'products', 'vendors', 'reels', 'orders', 'features', 'ownerOnly', 'authorization']],
  ['deterministic analytics', 'src/lib/ai/analytics-engine.ts', ['analyzeMiles', 'source: \'mastercart_backend\'', 'product_performance', 'vendor_sales']],
  ['capability registry', 'src/lib/ai/capability-registry.ts', ['FEATURE_REGISTRY', 'HELP_REGISTRY']],
  ['action confirmation and verification', 'src/lib/ai/actions.ts', ['MILES_ACTION_DEFINITIONS', 'CONFIRMATION_REQUIRED', 'could not be verified']],
  ['copilot mode routing', 'src/app/api/ai/copilot/route.ts', ['inferMilesMode', 'searchMiles', 'analyzeMiles', 'proposeMilesAct']],
  ['structured interactive card types', 'src/components/MilesGlobalWorkspace.tsx', ['reel', 'feature', 'help']],
  ['authenticated search API', 'src/app/api/ai/search/route.ts', ['getAuthenticatedUser', 'SEARCH_FORBIDDEN']],
  ['search performance migration', 'supabase/migrations/20260815_miles_search_engine.sql', ['pg_trgm', 'products_title_trgm_idx', 'brands_name_trgm_idx']],
];

const failures = [];
for (const [label, relative, needles] of checks) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename)) { failures.push(`${label}: missing ${relative}`); continue; }
  const source = fs.readFileSync(filename, 'utf8');
  for (const needle of needles) if (!source.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

if (failures.length) { console.error('Miles directive verification failed'); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Miles directive verification passed (${checks.length} architecture checks).`);
