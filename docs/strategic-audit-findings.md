# Strategic Directive Audit Findings

The connected production Supabase project is `prbukzquzqayzodhxdgf` and is active and healthy. The repository is `temirenile-commits/ABUAD-Fashion-Hub`, deployed through the connected Vercel project `abuad-fashion-hub`.

The actual public schema contains `users.name` and does not contain `users.full_name`. The `reviews` table contains `user_id`, `product_id`, `rating`, `comment`, `created_at`, `university_id`, and `brand_id`. The correct review relationships are users by `reviews_user_id_fkey` and products by `reviews_product_id_fkey`.

The existing AI table is `vendor_ai_settings` with `brand_id`, `ai_enabled`, `auto_reply_enabled`, `auto_accept_orders`, `custom_instructions`, `created_at`, and `updated_at`. The existing database trigger/function `handle_new_brand_ai_settings` is preserved. The prior Copilot route trusted client-provided `vendorId` and `brandId`; it has been changed to derive the authenticated user through the repository’s `getAuthenticatedUser` helper and verify brand ownership through `brands.owner_id`.

The financial tables and authoritative fields are: `orders.total_amount`, `orders.commission_amount`, `orders.vendor_earning`, `orders.delivery_fee_charged`, `orders.status`, `orders.created_at`, `orders.quantity`, `orders.brand_id`, and `orders.university_id`; `transactions.amount`, `transactions.type`, `transactions.status`, `transactions.brand_id`, and `transactions.created_at`; `wallets.available_balance`, `wallets.pending_balance`, `wallets.total_earnings`, and `wallets.total_withdrawn`; `payout_requests.amount_requested` and `payout_requests.status`; `brands.university_id`; and `universities.id`, `universities.name`, and `universities.abbreviation`.

The canonical billboard source is `platform_settings` with `key = manual_billboards`. There is no required `manual_billboards` table in the inspected schema. The university-admin read/write path was changed to use the canonical JSON setting directly. Expected empty-state repairs changed wishlist and delicacies billboard single-row lookups to null-safe handling, and the delicacies review query now uses `users.name` and `users.avatar_url`.

Supabase Edge Function deployment is available through the connected environment with JWT verification enabled by default. No Edge Function was present during the initial audit. The current application already has a server-side Next.js AI endpoint using the Google Gemini provider; provider credentials remain server-side and are not placed in `NEXT_PUBLIC_*` variables or source files.

New production database functions applied during this task are `get_vendor_financial_summary`, `get_platform_financial_summary`, `get_university_gmv_rankings`, and `get_vendor_sales_trend`. They aggregate eligible paid/fulfillment orders, wallet balances, payout requests, transactions, university GMV, and daily vendor trend data in Postgres.
