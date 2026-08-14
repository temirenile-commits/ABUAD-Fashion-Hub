# Miles AI Implementation Report

## Executive summary

Miles is now a server-side, authenticated MasterCart assistant with DeepSeek as the primary provider and OpenRouter Free as the fallback provider. Vendor ownership is derived from the authenticated session, store data is loaded through vendor-scoped server tools, provider credentials remain server-only, and provider-specific failures are masked from vendors.

The latest production incident affecting confirmed store-profile writes was diagnosed from the audit ledger. The executor attempted to update `brands.updated_at`, but the production `brands` table does not contain that column. The executor was corrected to update only validated brand fields. The same schema check confirmed that `services.updated_at` is also absent, so service updates were corrected at the same time.

## Implemented capabilities

| Area | Implementation | Status |
|---|---|---|
| Provider routing | DeepSeek primary with configuration-driven OpenRouter Free fallback | Complete |
| Provider security | API keys are server-side environment variables and are not bundled or logged | Complete |
| Authentication | Copilot and action routes reject unauthenticated requests | Verified with HTTP 401 |
| Vendor isolation | Brand ownership is derived from the authenticated session; product and service IDs are rechecked against that brand | Complete |
| Store activation | Vendor-controlled Store Access and Store Write Access controls | Complete |
| Read scope | Products, services, promotions, orders, Reels, messages, analytics, and vendor profile context | Complete for authenticated activated vendors |
| Write scope | Store profile, products, and confirmed service price updates; financial mutations remain outside the allowlist | Complete for implemented non-financial actions |
| Confirmation | Proposed changes are audited, expire after five minutes, require explicit `CONFIRM`, and cannot be replayed | Complete |
| Sensitive operations | Writes remain proposal-first and confirmation-gated; financial operations are not exposed as Miles actions | Complete |
| Assistant identity | Vendor can rename the displayed assistant; saved names persist across refreshes | Verified in production |
| Conversation UX | Quick suggestions, permission-state display, responsive panel sizing, and local recent-conversation persistence | Complete |
| Error handling | Technical provider and executor details remain server-side; vendors receive safe natural-language failures | Complete |

## Root-cause diagnosis and repair

The failed action was recorded in `miles_action_audit` as `update_store_profile`, with a confirmed timestamp but no execution timestamp. The sanitized payload contained only the requested store name change. Production schema inspection showed that `brands` has `name` and the other supported profile fields, but no `updated_at` column. The executor therefore failed at the database update step.

The repair removed `updated_at` from the `brands` update. A second schema check found that `services` also has no `updated_at` column, so the service executor was corrected to avoid sending it. TypeScript validation and the Vercel production build completed successfully after the repair.

## Production evidence

| Evidence | Result |
|---|---|
| Latest Git commit | `331411f` — `fix: execute Miles store actions against valid schemas` |
| Latest Vercel deployment | `dpl_5LHTvrx71VcNxu4gQ7RCzD3DaCBf` |
| Production deployment state | READY |
| Build validation | TypeScript completed successfully in Vercel build logs |
| Unauthenticated Copilot request | HTTP 401 `Authentication required` |
| Unauthenticated Miles action request | HTTP 401 |
| Post-fix authenticated store-profile action | User-confirmed successful in production |
| Audit ledger after fix | `update_store_profile` marked `executed` with result `Your store profile was updated.` |

The successful audit entry was created at `2026-08-14 22:24:12 UTC` and executed at `2026-08-14 22:24:13 UTC`. The earlier failed row remains in the ledger for audit history and is not retried automatically.

## Security and permission model

Miles is inactive for store access until the vendor enables the capability in AI Settings. Store Write Access is a separate vendor-controlled switch. When write access is enabled, Miles prepares a precise action proposal and waits for the vendor’s confirmation control. The server creates an audit record, binds it to the authenticated user and resolved brand, expires it after five minutes, hashes the request payload, and atomically claims the proposal before execution.

The action executor supports only explicit allowlisted non-financial fields. Financial transfers, payouts, withdrawals, bank changes, and payment mutations are not available through the Miles action allowlist. Provider names, prompts, internal reasoning, credentials, action payload internals, and database errors are not exposed in the vendor-facing UI.

## Files and migrations

The primary implementation files are `src/lib/ai/deepseek.ts`, `src/lib/ai/openrouter.ts`, `src/lib/ai/orchestrator.ts`, `src/lib/ai/config.ts`, `src/lib/ai/intelligence.ts`, `src/lib/ai/vendor-tools.ts`, and `src/lib/ai/actions.ts`. The main authenticated routes are `src/app/api/ai/copilot/route.ts`, `src/app/api/ai/actions/route.ts`, and `src/app/api/ai/auto-reply/route.ts`. The vendor dashboards are `src/app/dashboard/vendor/page.tsx` and `src/app/dashboard/delicacies/page.tsx`.

The reproducible schema changes are recorded in `supabase/migrations/20260814_miles_action_audit.sql`, `supabase/migrations/20260814_miles_store_access.sql`, and `supabase/migrations/20260814_miles_identity_and_intent.sql`.

## Final acceptance state

The previously reported read failure is fixed: after activation, Miles can answer authenticated vendor store questions such as the vendor’s store name. The previously reported confirmed-write failure is fixed and has been verified by a successful production store-profile update. The custom assistant name can be cleared while typing, replaced, saved, and retained after refresh. Unauthenticated access remains blocked, and the financial mutation boundary remains enforced.
