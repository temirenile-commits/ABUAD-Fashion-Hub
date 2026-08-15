# MasterCart Miles Automated Interactive Tour System

Source: `/home/ubuntu/upload/Untitleddocument.docx`

## Core requirements

Miles must be one root-mounted system that automatically determines public/authenticated state, detects roles and permissions, builds an appropriate tour, navigates with the existing router, locates stable targets, highlights them, displays a compact explanatory bubble, progresses automatically, and gracefully skips missing targets. The normal Miles chat must remain separate and must not open during onboarding.

## Required reusable pieces

- Dedicated `MilesTourBubble`: dark/black pill or rounded glass UI, Miles identity, concise human copy, responsive positioning around the target, safe viewport bounds, smooth motion, mobile support, keyboard and touch controls, pause/resume/skip/previous/next/exit.
- Reusable `MilesTourHighlight`: dim the rest of the page, keep the target visually prominent, use a glow/ring, avoid permanent target CSS mutation, preserve target functionality.
- Stable target registry via `data-miles-tour="..."`, replacing fragile selector-only targeting.
- Structured steps with route, target, title, explanation, duration, side/position, optional permission/capability metadata, and optional route-tab activation.

## Role behavior

- Public visitors: explain MasterCart, marketplace, discovery, vendor stores, Reels, search, login/account creation, and general navigation without private functionality.
- Customers: marketplace, search, categories, product details/reviews, cart, orders, Reels, vendor stores, profile, notifications, support, account features.
- Vendors: customer/base capabilities plus dashboard, products, creation/management, orders, wallet, analytics, Reels, customer interactions, store profile, settings, delivery tools.
- University admins: authorized university overview, vendors, marketplace, orders, analytics/statistics, vendor management, support, and university controls.
- Super admins: authorized platform overview, universities, vendors, users, analytics, financial/platform reporting, marketplace management, support, configuration, and administrative controls.
- Other admin roles: derive modules from actual permissions; do not assume all administrators are identical.
- Mixed-role accounts: compose all authorized modules into one deduplicated Miles tour.

## State, safety, accessibility

Persist completion, skip, current step, current route, role, and incomplete progress. Offer resume instead of unexpectedly restarting. Automatically begin first-login/first-available tour. Preserve auth/session/UI state across router navigation. Never expose unauthorized routes. If a target is absent, log it and skip safely. Support keyboard focus, screen readers where practical, readable contrast, touch, Android/iOS/desktop layouts, safe areas, and `prefers-reduced-motion`.

## Strict acceptance checklist

Automatic appropriate start; public tour; customer tour; vendor base plus vendor tour; permission-based admin tour; university admin; super admin; other admin permission handling; automatic navigation; target highlighting; black explanatory bubble; responsive positioning; no full chat during tour; persistent state; pause/skip/resume; missing-target recovery; unauthorized-route protection; mobile behavior; reduced-motion behavior; exactly one Miles system; existing chat intact; no UI regression; all roles tested; production build passes; no console errors.
