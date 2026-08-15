# MasterCart Miles Control & Configuration System

## Implementation checklist extracted from `pasted_content.txt`

### Architecture and hierarchy

- [ ] Maintain one Miles AI engine per authenticated user; do not create separate customer, vendor, university-admin, or super-admin engines.
- [ ] Implement configuration hierarchy: global, university, role, and user personal scopes.
- [ ] Define and enforce configuration precedence: global → university → role → personal.
- [ ] Explicitly define which lower-scope settings may override higher-scope settings.

### Personal configuration

- [ ] Add Account Settings → Personal → Miles for customers, vendors, and applicable admins.
- [ ] Persist personal Miles name, avatar/initial behavior, personalized-name toggle, read permission, write permission, proactive assistance, notifications, personality/preferences, tour-guide behavior, and connected capabilities as appropriate.
- [ ] Make personal configuration survive logout/login, new browser, new device, and new session.
- [ ] Create reusable `MilesIdentity` resolving name, initial, avatar, and display name.
- [ ] Derive the bubble initial dynamically from the effective name using the existing cursive treatment.
- [ ] Validate names for non-empty values, reasonable maximum length, normalization, safe rendering, and rejection of HTML/executable content.

### Personal read/write behavior

- [ ] Respect personal read access while preserving existing authorization rules.
- [ ] Support customer permitted read domains such as marketplace, own orders/account, products, vendors, Reels, reviews, relevant analytics, and public information.
- [ ] Support personal write access only through layered authentication, authorization, Miles permission, action permission, and confirmation checks.
- [ ] Do not grant unrestricted write access from a toggle alone.
- [ ] Preserve vendor-specific capabilities and integrate existing vendor Miles functionality.

### Administrative configuration

- [ ] Add administrator personal Miles settings that affect only the administrator’s own Miles.
- [ ] Add university-admin university Miles configuration subject to assigned authority.
- [ ] Support university name, personality, read/write capabilities, proactive behavior, support capabilities, analytics, university knowledge, onboarding, and notification settings.
- [ ] Add Super Admin global Miles configuration covering identity, personality, read/write capabilities, proactive behavior, tools, action policies, onboarding, support, knowledge, notifications, providers, fallbacks, and safety.
- [ ] Add separate Super Admin personal Miles settings.
- [ ] Add configurable university overrides stored as data, not hard-coded.
- [ ] Add Super Admin university management UI with university, name, read, write, and status plus detail configuration.
- [ ] Add admin Miles UI for My Miles, Scope Configuration, Permissions, Capabilities, Automation, and Audit Log.
- [ ] Add Super Admin-only global configuration, universities, role policies, global permissions, provider configuration, fallback configuration, system analytics, and audit logs.

### Granular permissions and safety

- [ ] Model category-level read and write permissions separately for products, orders, finance, payouts, users, vendors, support, analytics, and university operations.
- [ ] Add administrator granular capabilities for users, vendors, orders, support, analytics, and university operations.
- [ ] Keep financial calculations deterministic in MasterCart backend logic; Miles may retrieve, explain, summarize, compare, and visualize but not become source of truth.
- [ ] Require explicit confirmation for high-risk actions such as destructive, permission, financial, payout, suspension, deletion, and system-wide configuration operations.
- [ ] Ensure no sensitive action executes before confirmation.
- [ ] Require authenticated, authorized, validated, logged, and practically reversible configuration changes.
- [ ] Record audit data: actor, timestamp, setting, old value, new value, scope, and reason.
- [ ] Give every setting an explicit GLOBAL, UNIVERSITY, ROLE, or USER scope.

### Effective configuration and identity flow

- [ ] Implement backend `resolveMilesConfiguration(user)`.
- [ ] Return effective name, initial, read/write state, proactive state, and allowed tools/capabilities from the resolver.
- [ ] Make every Miles response use the effective active name.
- [ ] Remove hard-coded identity drift across bubble, chat, header, onboarding, notifications, tour bubble, messages, settings, loading, and error states.
- [ ] Use one shared cursive initial CSS/component everywhere.
- [ ] Ensure frontend consumes the backend effective configuration rather than guessing.

### Settings UX and provider privacy

- [ ] Add understandable Account Settings → Miles AI sections for identity, permissions, assistance, and advanced connected capabilities.
- [ ] Do not expose technical provider configuration to ordinary customers.
- [ ] Add administrative Miles controls with appropriate role restrictions.
- [ ] Keep provider/fallback settings Super Admin-only.

### Preservation and acceptance tests

- [ ] Inspect and preserve existing vendor Miles behavior.
- [ ] Remove duplicate identity/configuration logic without creating another Miles instance.
- [ ] Verify customer rename persistence and identity in bubble, chat, responses, login, and another device/session.
- [ ] Verify vendor capabilities remain intact.
- [ ] Verify university-admin override and personal override isolation.
- [ ] Verify Super Admin global and university scopes override correctly.
- [ ] Test Read OFF/Write OFF, Read ON/Write OFF, and Read ON/Write ON behavior.
- [ ] Verify unauthorized operations are rejected by the backend even when frontend Write is ON.
- [ ] Validate build, lint, database schema, responsive UI, privacy, and production deployment.
