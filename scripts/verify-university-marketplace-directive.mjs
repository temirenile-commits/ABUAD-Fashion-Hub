import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20260818_university_marketplace_switching.sql');
const patch = read('supabase/migrations/20260818_university_marketplace_switching_patch.sql');
const contextApi = read('src/app/api/university-context/route.ts');
const vendorApi = read('src/app/api/vendor/university-target/route.ts');
const adminApi = read('src/app/api/university-admin/route.ts');
const settings = read('src/app/settings/page.tsx');
const vendorPanel = read('src/components/VendorUniversityTargetPanel.tsx');
const adminPanel = read('src/components/VendorUniversityChangeRequestsPanel.tsx');
const realtime = read('src/components/providers/RealtimeProvider.tsx');

let passed = 0;
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); passed += 1; console.log(`PASS: ${name}`); };

check('request table has history and status fields', migration.includes('vendor_university_change_requests') && migration.includes('current_university_id') && migration.includes('requested_university_id') && migration.includes("status text not null default 'PENDING'"));
check('request table has scoped indexes and pending uniqueness', migration.includes('vendor_uni_change_requests_status_idx') && migration.includes('vendor_uni_change_requests_one_pending_idx')); 
check('customer switch is an authenticated RPC path', contextApi.includes("action === 'switch_customer'") && contextApi.includes('getAuthenticatedUser') && contextApi.includes('switch_marketplace_university'));
check('customer switch only accepts customer roles', contextApi.includes("['customer', 'user'].includes(existing.role)"));
check('active university validation exists', migration.includes('coalesce(is_active, true)') && contextApi.includes(".eq('is_active', true)"));
check('customer warning and confirmation UI exists', settings.includes('UniversityMarketplaceSwitcher') && read('src/components/UniversityMarketplaceSwitcher.tsx').includes('window.confirm'));
check('customer data refresh uses existing marketplace loader', realtime.includes("from('users').select('university_id')") && read('src/components/UniversityMarketplaceSwitcher.tsx').includes("window.location.assign('/')"));
check('vendor request requires verified and approved/verified status', `${migration}\n${patch}`.includes("lower(coalesce(v_brand.verification_status,'')) not in ('approved','verified')") && vendorPanel.includes('Only verified and approved vendors'));
check('vendor reason is validated', `${migration}\n${patch}`.includes('char_length(v_reason)<10') && vendorPanel.includes('minimum 10'));
check('vendor current target remains until approval', vendorPanel.includes('current target remains unchanged') && `${migration}\n${patch}`.includes("status:='APPROVED'"));
check('vendor submit and cancel actions exist', vendorApi.includes("action === 'submit'") && vendorApi.includes("action === 'cancel'") && migration.includes('cancel_vendor_university_change_request'));
check('approval moves products and reels', patch.includes('update public.products set university_id') && patch.includes('update public.reels set university_id'));
check('approval does not rewrite orders or referral history', !patch.includes('update public.orders') && !patch.includes('update public.referral'));
check('admin listing supports filters', adminApi.includes("action === 'vendor_university_change_requests'") && adminApi.includes("searchParams.get('status')") && adminApi.includes("searchParams.get('from')") && adminApi.includes("searchParams.get('to')"));
check('admin actions use secure RPCs', adminApi.includes('review_vendor_university_change_request') && adminApi.includes('message_vendor_university_change_request'));
check('admin UI has pending approved rejected views', adminPanel.includes('PENDING') && adminPanel.includes('APPROVED') && adminPanel.includes('REJECTED'));
check('vendor receives notifications and messages', migration.includes('public.notifications') && patch.includes('public.messages') && patch.includes('University admin sent you a message'));
check('vendor ownership and admin scope are enforced server-side', patch.includes('owner_id=p_requesting_user_id') && patch.includes('v_admin.university_id is distinct from v_request.requested_university_id'));
check('no duplicate authentication or parallel marketplace store', contextApi.includes("from '@/lib/server-auth'") && !contextApi.includes('createClient') && realtime.includes("useMarketplaceStore"));

console.log(`\nUniversity directive checks passed: ${passed}/19`);
