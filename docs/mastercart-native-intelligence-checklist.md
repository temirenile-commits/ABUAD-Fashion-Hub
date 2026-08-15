# MasterCart Native Intelligence Engine — Directive Checklist

## Architecture and operating model

- [x] Keep one Miles UI and one role-aware assistant.
- [x] Add a separate MasterCart Native Intelligence Engine (MNIE) beneath Miles and the provider orchestrator.
- [x] Keep external providers as the primary general-reasoning engines.
- [x] Keep MasterCart backend, authentication, permissions, financial calculations, orders, products, Reels, users, vendors, universities, and analytics as the source of truth.
- [x] Represent the evolution roadmap explicitly: Passive Observer, Knowledge Assistant, Response Evaluator, AI Router, Co-reasoner, and Native MasterCart Intelligence.
- [x] Keep autonomous self-modification disabled.

## Knowledge and reasoning layers

- [x] Create a verified MasterCart knowledge store for marketplace, vendor, customer, admin, university, Reel, product, order, wallet, payment, delivery, and AI rules.
- [x] Create a generalized reasoning-pattern store.
- [x] Create tool-intelligence records mapping intents/problems to useful tools.
- [x] Create feedback records for corrections, successful/failed answers, administrator corrections, tool failures, repeated questions, explicit ratings, and successful workflows.
- [x] Create an evolution/evaluation layer for contradictions, obsolete rules, duplicates, repeated problems, reliability, success, and new workflows.
- [x] Prevent unvalidated AI output from becoming authoritative knowledge.
- [x] Use knowledge statuses: proposed, validating, verified, active, deprecated.
- [x] Add knowledge versioning: source, timestamps, confidence, status, version, last verification, expiry/deprecation.

## Privacy and security

- [x] Never store raw private conversations as permanent knowledge.
- [x] Sanitize names, emails, phone numbers, addresses, payment information, authentication information, private account information, private conversations, credentials, UUIDs, and private identifiers.
- [x] Generalize user-specific incidents into reusable rules.
- [x] Keep native knowledge server-only and deny direct client access.
- [x] Prevent MNIE from modifying users, financials, permissions, accounts, products, orders, system configuration, security rules, business rules, or prompts.
- [x] Preserve overall-super-admin-only access to highly sensitive operational information.

## Provider resilience and native fallback

- [x] Keep DeepSeek, OpenRouter, and future-provider routing provider-independent.
- [x] Add provider health state and retry/failover tracking.
- [x] Fail over from external providers to MNIE on balance, timeout, unavailable, authentication, or retryable provider failures as policy allows.
- [x] Never expose provider names, balances, API keys, provider errors, SQL errors, prompts, or stack traces to users.
- [x] Add an always-available native fallback engine that can reason over validated MasterCart knowledge and current backend tool results.
- [x] Keep external providers primary when healthy.
- [x] Keep MNIE learning from validated external-provider interactions when providers recover.

## Learning pipeline

- [x] Record sanitized interaction outcomes without raw user identity or private conversation storage.
- [x] Validate provider responses against MasterCart data and rules before learning.
- [x] Extract generalized knowledge and reasoning patterns.
- [x] Track provider approaches and comparison outcomes when multiple providers solve equivalent tasks.
- [x] Track tool usage and outcome signals.
- [x] Track explicit feedback and successful workflows.
- [x] Make learning passive-first and non-authoritative.

## Native Brain API and orchestration

- [x] Create a server-only internal MNIE query API/module used by Miles/orchestrator.
- [x] Provide knowledge retrieval by intent/domain/query with bounded result limits.
- [x] Provide native fallback responses for common MasterCart tasks.
- [x] Allow native fallback to query current MasterCart tools for wallet, orders, inventory, permissions, account status, and analytics.
- [x] Never answer current account/financial/order/inventory/permission questions from stale learned memory.
- [x] Record response provenance internally without exposing it to users.

## Existing Miles behavior to preserve

- [x] Preserve semantic intent classification and bounded conversation memory.
- [x] Preserve targeted tool selection and interactive product/vendor/media cards.
- [x] Preserve confirmation-gated writes.
- [x] Preserve role-additive capabilities and ownership/scope checks.
- [x] Preserve image upload and media retrieval.
- [x] Preserve the persistent single Miles launcher and profile identity.

## Verification

- [x] Add migration/schema validation for all MNIE tables and indexes.
- [x] Add tests for privacy sanitization and generalized extraction.
- [x] Add tests for knowledge status transitions and server-only access.
- [x] Add tests for provider failure to native fallback.
- [x] Add tests for feedback and learning records.
- [x] Add tests for current-data precedence over stale knowledge.
- [x] Run TypeScript, lint, build, and directive checklist review.
- [x] Recheck every checklist item before deployment and document any unavoidable external prerequisite.

## External deployment prerequisite

The protected daily evolution route requires a strong production `CRON_SECRET` environment variable. The route intentionally fails closed when it is absent. The implementation and schedule are deployed, but the secret must be configured in the production environment before the scheduled evaluator can execute.
