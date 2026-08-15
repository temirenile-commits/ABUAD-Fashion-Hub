# MasterCart Google OAuth Directive Audit

## Scope

The attached `pasted_content.txt` is treated as the authoritative implementation specification for the production Google OAuth regression.

## Findings

| Directive requirement | Existing state | Finding | Required action |
|---|---|---|---|
| Dedicated `app/auth/callback/route.ts` | Present in the repository and compiled into the latest deployment. | The callback exists, exchanges the code server-side, and writes cookies onto its redirect response. | Preserve and extend only for role-aware routing and canonical-origin compliance. |
| Google → Supabase callback → MasterCart callback separation | Frontend uses Supabase `signInWithOAuth`; callback route is `/auth/callback`. | Architecture is correct; these callback stages must not be conflated. | Preserve the Supabase provider callback and use MasterCart only as `redirectTo`. |
| Canonical production origin | Existing helper allowed multiple production hosts and currently defaulted to `master-cart-camp.vercel.app`. | The directive requires `master-cart-reshuffled.vercel.app`; the old video host `mastercart-shuffled.vercel.app` is a removed deployment. | Set production OAuth initiation to `https://master-cart-reshuffled.vercel.app`; keep local development behavior. |
| Secure `returnTo` | Existing helper rejects external URLs and protocol-relative paths. | Core protection is present. | Preserve it and restrict dashboard returns to role-authorized destinations. |
| Supabase callback URL configuration | Live Supabase project is `prbukzquzqayzodhxdgf`; database migrations are present. | Auth URL settings are not exposed by the connected database migration API and must be verified through the Auth/Vercel configuration surfaces. | Keep Google’s redirect URI at the Supabase Auth callback; use the canonical MasterCart callback as the application redirect. |
| Google provider redirect URI | Video shows Google correctly reaches the Supabase callback. | The provider-stage architecture is not the failure. | Do not change the Google → Supabase URI. |
| OAuth state and double-click protection | Login/register handlers set `loading` before `signInWithOAuth`; buttons are disabled by loading state. | No duplicate OAuth starter was found in the audited source. | Preserve, and keep exactly one OAuth request per click. |
| PKCE and cookies | Callback uses `exchangeCodeForSession` and the same `NextResponse` receives cookies. | This was previously broken by returning a different redirect response; current code has the correct response pattern. | Preserve and test callback error paths. |
| Role redirection | Email/password login performs role-based redirects; OAuth callback previously returned only the requested/root path. | Existing Google users could authenticate without reaching their correct dashboard. | Reuse existing role vocabulary and redirect customers, vendors, university admins, riders, and admins appropriately. |
| Email/password login | Existing email/password flow is separate and working. | Must not be replaced or duplicated. | Leave the password flow unchanged and regression-test it. |
| Public callback reachability | No `middleware.ts` or callback guard was found in the repository. | The callback itself is publicly reachable at application level. | Verify deployment protection separately. |
| Vercel protection | Live project protection reported `ssoProtection.enabled=true` with `deploymentType=all_except_custom_domains`. | This directly explains the Vercel login page on Vercel aliases. | Disable project-level Vercel Authentication while preserving password and trusted-IP settings. |
| Production environment audit | Repository has no committed Supabase environment values; only non-auth local key names were present. | Secret values are not exposed. The deployed environment must be validated by deployment/runtime behavior. | Do not print secrets; document environment-name checks and validate canonical deployment. |
| Supabase advisor warnings | Live advisor reports RLS-without-policy notices on Miles tables, mutable search paths, public `pg_trgm`, executable `touch_miles_configurations`, and disabled leaked-password protection. | These are pre-existing and explicitly outside the direct OAuth fix. | Record separately; do not mix unrelated schema changes into this authentication patch. |
| Test matrix | Static build/type checks existed; complete Google role/clean-session testing requires a real browser session and provider accounts. | Build success alone is insufficient. | Run all possible deterministic tests and document any provider-account tests that require user credentials. |

## Connected environment evidence

The GitHub repository is `temirenile-commits/ABUAD-Fashion-Hub`, on `main`, clean before the new edits, with the prior OAuth commits `fe4afa3` and `c589d22` in history. The live Supabase project contains `public.users`, `public.brands`, and the Miles configuration/action tables, with migrations through `miles_search_engine_indexes`. The live Vercel project is `abuad-fashion-hub`, and its current production aliases include `master-cart-reshuffled.vercel.app` and `master-cart-camp.vercel.app`.

## Immediate root cause

The production Vercel project had Vercel Authentication enabled for all non-custom domains. Since the canonical MasterCart aliases are Vercel domains rather than custom domains, the OAuth return request could be intercepted by `vercel.com/login` before MasterCart’s `/auth/callback` handler ran. The protection setting is being corrected at the project level; application-level MasterCart authentication remains unchanged.
