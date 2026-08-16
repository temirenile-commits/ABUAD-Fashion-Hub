import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const expect = (name, condition, detail) => checks.push({ name, pass: Boolean(condition), detail });

const chrome = read('src/components/ResponsiveAdminChrome.tsx');
const chromeCss = read('src/components/ResponsiveAdminChrome.module.css');
const admin = read('src/app/admin/page.tsx');
const adminCss = read('src/app/admin/admin.module.css');
const uni = read('src/app/university-admin/page.tsx');
const uniCss = read('src/app/university-admin/university-admin.module.css');
const support = read('src/app/dashboard/support/page.tsx');
const supportCss = read('src/app/dashboard/support/support.module.css');
const rbac = read('src/lib/rbac.ts');

expect('single shared mobile chrome implementation', [admin, uni, support].every(source => source.includes('ResponsiveAdminChrome')) && chrome.includes('function ResponsiveAdminChrome'), 'All admin-like surfaces import the same component.');
expect('mobile drawer navigation', chrome.includes('drawerOpen') && chrome.includes('aria-label="Open admin navigation"'), 'The existing desktop sidebar is replaced by a compact drawer on mobile.');
expect('role-filtered university navigation', uni.includes('hasAccess') && uni.includes('visibleManagement') && uni.includes('ResponsiveAdminChrome'), 'University-admin permissions remain the source of visible mobile tabs.');
expect('support role-aware navigation', support.includes('isHead') && support.includes('navigation'), 'Support settings remain restricted to head/admin roles.');
expect('safe-area support', chromeCss.includes('safe-area-inset-top') && chromeCss.includes('safe-area-inset-bottom'), 'Mobile header and drawer account for notches and gesture areas.');
expect('touch-sized controls', chromeCss.includes('min-width:44px') && chromeCss.includes('min-height:48px') && adminCss.includes('min-height: 44px') && uniCss.includes('min-height: 44px'), 'Navigation and primary controls meet practical mobile touch sizing.');
expect('controlled table overflow', adminCss.includes('overflow-x: auto') && uniCss.includes('overflow-x: auto') && supportCss.includes('overflow-x:auto'), 'Wide tables remain usable through controlled horizontal scrolling.');
expect('responsive cards', adminCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && uniCss.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'Dashboard cards use readable two-column mobile grids.');
expect('responsive charts', adminCss.includes('.chartsGrid { grid-template-columns: minmax(0, 1fr)') && uniCss.includes('.chartGrid { grid-template-columns: minmax(0, 1fr)'), 'Analytics layouts collapse without compressing the chart into unreadable columns.');
expect('mobile full-screen dialogs', adminCss.includes('min-height: 100dvh') && uniCss.includes('min-height: 100dvh'), 'Long admin operations can use viewport-safe sheets/dialogs.');
expect('small phone and landscape rules', adminCss.includes('max-width: 420px') && uniCss.includes('max-width: 420px') && adminCss.includes('orientation: landscape') && uniCss.includes('orientation: landscape'), 'Small phone and landscape layouts have explicit handling.');
expect('all canonical admin roles remain represented', ['super_admin','admin','sub_admin','university_admin','university_staff','customer_support_agent'].every(role => rbac.includes(role)), 'The responsive UI does not narrow the existing authorization model.');
expect('desktop layout preserved', adminCss.includes('@media (max-width: 768px)') && uniCss.includes('@media (max-width: 768px)') && adminCss.includes('.sidebar { display: none; }') && uniCss.includes('.sidebar { display: none; }'), 'Mobile-only overrides leave desktop rules unchanged and hide only the old mobile-inappropriate chrome.');

const failures = checks.filter(check => !check.pass);
for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name} — ${check.detail}`);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
if (failures.length) process.exit(1);
