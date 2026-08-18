# University Marketplace Production Verification

Date: 2026-08-18

## Deployment

Production deployment for commit `510420c5107edfa796bcdca03a7ab5b2732ee156` reached Vercel `READY` state. Aliases include `master-cart-reshuffled.vercel.app` and `master-cart-camp.vercel.app`.

## Safe smoke checks

The production homepage returned HTTP 200. The unauthenticated `/api/university-context` endpoint returned HTTP 401 with `Authentication required`, confirming the route does not expose context anonymously.

## Authenticated session

The connected browser session authenticated successfully as `temirenile@gmail.com`, with role `delivery` and customer context. The account’s current university is `cxc`. The customer context GET endpoint returned HTTP 200 and listed 12 active universities.

A customer switch POST was intentionally attempted against the delivery role and correctly returned HTTP 403 with `Only customer accounts can switch marketplace university.` This confirms server-side role enforcement. A customer-only switch could not be completed with this account because it is not a customer-role account.

## Vendor workflow

The same authenticated account has an associated verified vendor brand. The vendor target GET endpoint returned the brand target as Afe Babalola University Ado-Ekiti (ABUAD), verification status `verified`, and no pending requests.

A temporary request to Pan-Atlantic University was submitted with a valid reason. Submission returned HTTP 200 and status `PENDING`. The request was immediately cancelled through the production cancellation action, returning HTTP 200 and status `CANCELLED`. A follow-up GET confirmed zero pending requests and that the current vendor target remained ABUAD.

## Admin workflow

The authenticated session was not a university administrator. The admin request-list endpoint returned HTTP 401 with `Unauthorized: No valid session`, so admin approval, rejection, and messaging could not be executed in this session. The deterministic regression suite and server-side scoped RPC checks cover the admin implementation; a university-admin account is required for live admin-action verification.

## Cleanup

No active pending request remains. No university target, product, reel, order, referral, or account history was changed by the verification.
