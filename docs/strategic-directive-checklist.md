# MasterCart Strategic Directive Implementation Checklist

## AI Copilot and security

- [ ] Trace the Vendor Dashboard → Copilot UI → API → authentication → provider → Supabase → response path.
- [ ] Preserve `vendor_ai_settings` and `handle_new_brand_ai_settings` unless a concrete defect requires a change.
- [ ] Authenticate every Copilot request and derive the vendor’s `brand_id` from the authenticated user, not client-supplied ownership fields.
- [ ] Load only the requesting vendor’s AI settings and business context.
- [ ] Keep provider credentials server-side; never expose them in React, browser JavaScript, `NEXT_PUBLIC_*`, GitHub, or client bundles.
- [ ] Return structured responses and handle provider failures with useful server-side logging.
- [ ] Support system-guide, personal-vendor-assistant, and operational-attention modes.
- [ ] Keep financial/account/security actions read-only or confirmation-gated.
- [ ] Add the server-side Supabase Edge Function if required by the deployed architecture.

## API and schema repairs

- [ ] Remove all incorrect `users.full_name` references; use canonical `users.name`.
- [ ] Make reviews retrieval return reviewer name/avatar, product relationship, rating, text, and `created_at` successfully.
- [ ] Handle empty wishlist results without a 406/error state.
- [ ] Handle missing delicacies billboards with a normal fallback state.
- [ ] Trace all `manual_billboards` references and use the canonical `platform_settings` JSON storage where appropriate; do not create duplicate storage.

## Canonical financial analytics

- [ ] Create one database-side analytics layer over `orders`, `transactions`, `wallets`, `brands`, and `universities`.
- [ ] Define gross sales, eligible sales, vendor earnings, platform revenue, commissions/fees, delivery revenue, refunds, pending earnings, completed payouts, available balance, transaction volume, and order volume separately.
- [ ] Keep wallet balances authoritative from `wallets`, not chart-derived.
- [ ] Make vendor financials use canonical data for gross sales, vendor earnings, pending earnings, available balance, withdrawn amount, order count, and average order value.
- [ ] Make admin financials use the same definitions for GMV, platform revenue, vendor earnings, delivery revenue, pending/completed payouts, and order volume.
- [ ] Respect super-admin global scope and university-admin university scope.
- [ ] Define university GMV ranking from eligible `orders.total_amount`, with separate order/sales/vendor-activity ranking modes.
- [ ] Return rank, university, GMV, orders, and growth.
- [ ] Support Today, 7 Days, 30 Days, 3 Months, 6 Months, 12 Months, and Custom ranges with consistent boundaries.
- [ ] Aggregate in Postgres/database-side queries; do not download large raw datasets into React for calculation.

## Dashboard and chart UX

- [ ] Make charts consume already-calculated aggregates.
- [ ] Ensure every chart answers one clear business question.
- [ ] Provide readable sales trend, revenue breakdown, order-volume, vendor-earnings, and university-ranking views where applicable.
- [ ] Make charts professional, mobile responsive, desktop responsive, correctly scaled, and properly labelled.
- [ ] Use sensible Nigerian naira formatting and avoid misleading axes, random percentages, overlap, excessive decimals, and empty chart areas.
- [ ] Keep financial definitions consistent across super-admin, university-admin, other admin, and vendor dashboards.

## Verification and regression protection

- [ ] Test real database records for totals, earnings, transactions, orders, wallet balance, payouts, date filtering, university filtering, ranking, and chart values.
- [ ] Independently calculate representative results against database records.
- [ ] Test Copilot prompts for pending orders, earnings, Reel posting, attention items, and product management.
- [ ] Test vendor isolation so Vendor A cannot receive Vendor B’s private data.
- [ ] Preserve Reels, marketplace purchasing, wallet, payout, vendor posting, and authentication behavior unless a confirmed dependency requires a repair.
- [ ] Commit, deploy, and verify production only after all applicable checklist items pass.
- [ ] Produce a technical report covering root causes, architecture, files, database functions/queries, formulas, chart data source, ranking formula, eliminated errors, tests, and remaining issues.
