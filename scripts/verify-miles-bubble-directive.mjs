import fs from 'node:fs';
import assert from 'node:assert/strict';

const bubble = fs.readFileSync('src/components/MilesPersistentBubble.tsx', 'utf8');
const provider = fs.readFileSync('src/components/MilesConfigurationProvider.tsx', 'utf8');
const visual = fs.readFileSync('src/components/MilesVisualIdentity.tsx', 'utf8');
const workspace = fs.readFileSync('src/components/MilesGlobalWorkspace.tsx', 'utf8');
const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
const checks = [
  ['authoritative uploaded asset exists', fs.existsSync('public/branding/miles-ai-reference.png')],
  ['one shared visual primitive', bubble.includes("@/components/MilesVisualIdentity") && provider.includes("@/components/MilesVisualIdentity")],
  ['dynamic initial is configuration-driven', bubble.includes('configuration.identity.initial') && visual.includes("name?.charAt(0)" )],
  ['no hard-coded bubble letter', !bubble.includes('<span className="miles-mark"')],
  ['cursive letter styling', visual.includes('Brush Script MT') && visual.includes('Segoe Script')],
  ['shared avatar/profile identity', provider.includes('<MilesVisualIdentity') && workspace.includes('MilesProfileAvatar')],
  ['drag and dock behavior preserved', bubble.includes('onPointerMove') && bubble.includes('snapPosition') && bubble.includes('POSITION_KEY')],
  ['tap and full-screen events preserved', bubble.includes('mastercart:miles-open') && bubble.includes('mastercart:miles-full-open')],
  ['single global mount preserved', layout.includes('<MilesPersistentBubble />') && layout.includes('<MilesGlobalWorkspace />')],
  ['auth role gating preserved', bubble.includes('supabase.auth.getUser') && bubble.includes('isAuthenticatedRole')],
  ['responsive safe positioning preserved', bubble.includes('SAFE_BOTTOM') && bubble.includes('clampPosition') && workspace.includes('env(safe-area-inset-bottom)')],
  ['reduced motion support preserved', visual.includes('prefers-reduced-motion')],
];
for (const [name, ok] of checks) {
  assert.ok(ok, name);
  console.log(`PASS ${name}`);
}
console.log(`Miles bubble directive checks passed: ${checks.length}/${checks.length}`);
