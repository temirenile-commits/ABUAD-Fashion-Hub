# Miles Universal Intelligence Directive Compliance

The MasterCart implementation uses one role-aware Miles engine per authenticated user. `resolveMilesContext` composes the authenticated session, role, university scope, vendor ownership, permissions, and effective configuration before any retrieval, analysis, or action occurs.

| Directive area | Implementation | Validation |
|---|---|---|
| One Miles engine across roles | `src/lib/ai/miles-engine.ts`, shared copilot route, shared configuration provider | TypeScript, build, architecture verification |
| Centralized Search Engine | `src/lib/ai/search-engine.ts` and `/api/ai/search` | Search domain/type checks, route build |
| Role-aware retrieval | Permission checks precede every domain query; university and brand scopes are applied before retrieval | Context and API checks |
| Search priority | Exact, prefix, fuzzy token overlap and bounded result ranking are used before any model response | Search Engine implementation review |
| Products, vendors, stores, Reels, orders, users | Dedicated domains and specialized exports | Search route contract |
| Knowledge versus functionality | Help Registry and Capability Registry are separate from database retrieval | Registry module and navigation cards |
| Interactive cards | Product, vendor, Reel, feature, and help cards include canonical routes and media | Miles workspace type/build validation |
| Navigation assistance | Capability Registry returns role-filtered routes and actions | `features` search domain |
| Analytics | `src/lib/ai/analytics-engine.ts` computes deterministic metrics from validated records | Backend source marker and build |
| Actions | Existing controlled Action Engine is wrapped by the explicit Act facade | Confirmation, ownership, and write-permission checks |
| Action verification | Store, service, product updates and product creation read back the result before success is reported | Action Engine verification branches |
| Confirmation | High-impact mutations create short-lived auditable proposals and require explicit `CONFIRM` | Existing action audit flow |
| Privacy | Safe authorization summaries, redaction, no credentials/raw prompt exposure, bounded results | Copilot rules and safe failure responses |
| Provider abstraction | Search, analytics, and action layers do not depend on a specific model provider | Provider orchestration remains unchanged |
| Search failure handling | Permission denial, empty search, ambiguity, and service failure use safe user-facing messages | Copilot response handling |
| Performance | PostgreSQL trigram/scoped indexes, bounded limits, pagination-compatible queries, and no raw storage-object search | Live migration `miles_search_engine_indexes` |
| Observability | Safe telemetry records intent, entity domain, count, latency, ambiguity, failure, and permission rejection without storing message text | `[MILES_SEARCH_TELEMETRY]` event |

The production validation sequence is: directive verification script, TypeScript compilation, production build, targeted lint, `git diff --check`, live Supabase migration verification, and Vercel deployment verification.
