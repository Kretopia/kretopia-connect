# Kretopia documentation index

Use this page to find product, implementation, and delivery notes without
mistaking an old audit for the current application contract.

## How to use these documents

- **Code and configuration describe the checked-in implementation.** Start in
  [`src/`](../src/), [`supabase/`](../supabase/), or at the relevant root
  configuration file when you need to know what the app currently does.
- **Reports capture a point-in-time review.** Their recommendations, test
  results, paths, and release status may have changed since they were written.
  Check each report's scope and date before relying on it.
- **This index classifies and links; it does not designate an approval or
  current release status.** Existing files remain in place so their links and
  historical context are preserved.

## Product and experience

### Product map and shared surfaces

- [Canonical product map](roadmap/canonical-product-map.md) — maps product
  language to existing records and calls out mismatches; dated roadmap material,
  not a current runtime verification.
- [Canonical product and permission map](roadmap/canonical-product-and-permission-map.md)
  — a later, code-evidenced gate document with its own stated snapshot date.
- [Core surfaces audit](../CORE_SURFACES_AUDIT.md) and
  [core surfaces QA](../CORE_SURFACES_QA.md).
- [Component hierarchy audit](../COMPONENT_HIERARCHY_AUDIT.md) — historical
  route/component observations; paths and line numbers need rechecking.
- [Feature surface audit](../FEATURE_SURFACE_AUDIT.md) and
  [feature surface QA](../FEATURE_SURFACE_QA.md).
- [Global UX system audit](../GLOBAL_UX_SYSTEM_AUDIT.md) and
  [global UI inventory](../GLOBAL_UX_UI_INVENTORY.md).
- [UX navigation audit](../UX_NAVIGATION_AUDIT.md).

### Passport, profile, and identity

- [Passport/Studio rearchitecture audit](../PASSPORT_STUDIO_REARCHITECTURE_AUDIT.md)
  — historical assessment; do not assume its test baseline or findings are
  current.
- [Passport and conversion audit](../PASSPORT_AND_CONVERSION_AUDIT.md).
- [Passport sharing QA](../PASSPORT_SHARE_QA.md).
- [Public Passport route fix report](../PUBLIC_PASSPORT_ROUTE_FIX_REPORT.md).
- [Kreto identity mark report](../KRETO_IDENTITY_MARK_REPORT.md) and
  [Kreto privacy and trust report](../KRETO_PRIVACY_AND_TRUST_REPORT.md).

### Studio, projects, and New Room

- [Studio current-state audit](../STUDIO_CURRENT_STATE_AUDIT.md) and
  [Studio information architecture overhaul](../STUDIO_INFORMATION_ARCHITECTURE_OVERHAUL.md).
- [Studio overhaul current state](../STUDIO_OVERHAUL_CURRENT_STATE.md),
  [V2 audit](../STUDIO_OVERHAUL_V2_AUDIT.md), and
  [V2 implementation report](../STUDIO_OVERHAUL_V2_IMPLEMENTATION_REPORT.md).
- [Studio dashboard data contract](../STUDIO_DASHBOARD_DATA_CONTRACT.md) and
  [room progress model](../STUDIO_ROOM_PROGRESS_MODEL.md).
- [Studio loose projects QA](../STUDIO_LOOSE_PROJECTS_QA.md) and
  [Studio room navigator report](../STUDIO_ROOM_NAVIGATOR_REPORT.md).
- [New Room draft contract](../NEW_ROOM_DRAFT_CONTRACT.md),
  [AI intake spec](../NEW_ROOM_AI_INTAKE_SPEC.md), and
  [guided creation report](../NEW_ROOM_GUIDED_CREATION_REPORT.md).
- [ThriveDesk analysis](../THRIVEDESK_ANALYSIS.md).

### Today, Scout, Kreto, and discovery

- [Today command center QA](../TODAY_COMMAND_CENTER_QA.md),
  [component consolidation report](../TODAY_COMPONENT_CONSOLIDATION_REPORT.md),
  and [personalization and interaction report](../TODAY_PERSONALIZATION_AND_INTERACTION_REPORT.md).
- [Scout design system reference](../SCOUT_DESIGN_SYSTEM_REFERENCE.md) and
  [Scout scan performance report](../SCOUT_SCAN_PERFORMANCE_REPORT.md).
- [Kreto functionality fix report](../KRETO_FUNCTIONALITY_FIX_REPORT.md),
  [conversation sessions spec](../KRETO_CONVERSATION_SESSIONS_SPEC.md), and
  [surface placement map](../KRETO_SURFACE_PLACEMENT_MAP.md).
- [Kreto new-room state mapping audit](../KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md)
  and [Kreto execution MVP](roadmap/kreto-execution-mvp.md).

### Landing, navigation, and visual system

- [Landing page audit](../LANDING_PAGE_AUDIT.md),
  [V2 audit](../LANDING_V2_AUDIT.md), and
  [final conversion audit](../LANDING_FINAL_CONVERSION_AUDIT.md).
- [Landing accessibility report](../LANDING_ACCESSIBILITY_REPORT.md),
  [motion system audit](../LANDING_MOTION_SYSTEM_AUDIT.md), and
  [performance/SEO report](../LANDING_PERFORMANCE_SEO_REPORT.md).
- [Global header UX audit](../GLOBAL_HEADER_UX_AUDIT.md),
  [page container alignment report](../GLOBAL_PAGE_CONTAINER_ALIGNMENT_REPORT.md),
  and [typography system](../TYPOGRAPHY_SYSTEM.md).
- [Motion system](../MOTION_SYSTEM.md) and
  [responsive accessibility QA](../RESPONSIVE_ACCESSIBILITY_QA.md).

### Stages, events, and communication

- [On Stage UX/UI architecture](../ON_STAGE_UX_UI_ARCHITECTURE.md),
  [security and permission report](../ON_STAGE_SECURITY_AND_PERMISSION_REPORT.md),
  and [release gate](../ON_STAGE_RELEASE_GATE.md).
- [SoundStages audit](../SOUNDSTAGES_AUDIT.md).
- [Event communication delivery report](../EVENT_COMMUNICATION_DELIVERY_REPORT.md),
  [event comments reliability report](../EVENT_COMMENTS_RELIABILITY_REPORT.md),
  and [event reminders report](../EVENT_REMINDERS_N1_FIX_REPORT.md).
- [Messages inbox layout report](../MESSAGES_INBOX_LAYOUT_FIX_REPORT.md) and
  [notification migration report](../NOTIFICATION_MIGRATION_REPORT.md).

## Payments, commerce, and finance

- [KrePay payment system inventory](../KREPAY_PAYMENT_SYSTEM_INVENTORY.md),
  [payment capability matrix](../KREPAY_PAYMENT_CAPABILITY_MATRIX.md), and
  [payment audit](../KREPAY_PAYMENT_AUDIT.md).
- [KrePay dashboard data contract](../KREPAY_DASHBOARD_DATA_CONTRACT.md).
- [KrePay Stripe replacement decision memo](../KREPAY_STRIPE_REPLACEMENT_DECISION_MEMO.md)
  and [Stripe configuration report](../KREPAY_STRIPE_CONFIGURATION_REPORT.md).
- [KrePay release gate](../KREPAY_RELEASE_GATE.md),
  [live release gate](../KREPAY_LIVE_RELEASE_GATE.md), and
  [production blockers](../KREPAY_PRODUCTION_BLOCKERS.md).
- [Escrow state machine](../ESCROW_STATE_MACHINE.md),
  [flow audit](../ESCROW_FLOW_AUDIT.md), and
  [idempotency report](../ESCROW_IDEMPOTENCY_REPORT.md).
- [Escrow privilege migration runbook](../ESCROW_PRIVILEGE_MIGRATION_RUNBOOK.md)
  and [RLS negative test report](../ESCROW_RLS_NEGATIVE_TEST_REPORT.md).
- [Wallet security verification](../WALLET_SECURITY_VERIFICATION_REPORT.md) and
  [client path verification](../WALLET_CLIENT_PATH_VERIFICATION_REPORT.md).
- [Subscription guide](../SUBSCRIPTION_GUIDE.md) and
  [Hire-to-KrePay E2E report](../HIRE_TO_KREPAY_E2E_REPORT.md).
- [Payment and webhook evidence](roadmap/) — the roadmap folder also contains
  focused evidence on payouts, invoices, checkout, wallets, and webhooks.

## Platform, backend, and security

- [Supabase configuration](../supabase/config.toml), [functions](../supabase/functions/),
  and [migrations](../supabase/migrations/) are implementation/deployment inputs;
  preserve their paths and migration identifiers.
- [Edge function manifest](../EDGE_FUNCTION_MANIFEST.md) and
  [deployment report](../EDGE_FUNCTION_DEPLOYMENT_REPORT.md).
- [Security audit 2026](../SECURITY_AUDIT_2026.md),
  [security checklist](../SECURITY_CHECKLIST.md), and
  [security release gate](../SECURITY_RELEASE_GATE.md).
- [Function security matrix](../FUNCTION_SECURITY_MATRIX.md) and
  [privilege drift investigation](../PRIVILEGE_DRIFT_INVESTIGATION.md).
- [Lovable Cloud migration runbook](../LOVABLE_CLOUD_MIGRATION_RUNBOOK.md),
  [access report](../LOVABLE_CLOUD_ACCESS_REPORT.md), and
  [execution report](../LOVABLE_CLOUD_EXECUTION_REPORT.md).
- [AI features](../AI_FEATURES.md),
  [AI automation audit](../AI_AUTOMATION_AUDIT.md), and
  [project autopilot audit](../PROJECT_AUTOPILOT_AUDIT.md).
- [Monitoring setup](../MONITORING_SETUP.md) and
  [analytics event taxonomy](../ANALYTICS_EVENT_TAXONOMY.md).
- [Dated security evidence and deployment notes](roadmap/) live alongside
  product roadmap files; use each document's own date and scope.
- [Security-specific notes and SQL](../security/) are kept separately from
  general product reports.

## Quality, performance, and delivery

- [Test gate report](../TEST_GATE_REPORT.md) and
  [final QA report](../FINAL_QA_REPORT.md).
- [Launch readiness report](../LAUNCH_READINESS_REPORT.md),
  [launch checklist](../LAUNCH_CHECKLIST.md), and
  [beta launch checklist](../BETA_LAUNCH_CHECKLIST.md).
- [Deadline-day release gate](../DEADLINE_DAY_RELEASE_GATE.md) and
  [release report](../FINAL_AUGUST_31_RELEASE_REPORT.md).
- [Performance report](../PERFORMANCE_REPORT.md),
  [performance validation report](../PERFORMANCE_VALIDATION_REPORT.md), and
  [Kreto bundle size report](../KRETO_BUNDLE_SIZE_REPORT.md).
- [Accessibility audit](../ACCESSIBILITY_AUDIT.md) and
  [responsive accessibility matrix](../RESPONSIVE_A11Y_MATRIX.md).
- Landing and On Stage sections above include their browser, accessibility,
  performance, and release evidence.
- [Version and SEO plugins](../plugins/) are source code, not reports.

## Roadmaps, proposals, and historical records

- [Roadmap](../ROADMAP.md), [beta roadmap](../BETA_ROADMAP.md), and
  [MVP optimization plan](../MVP_OPTIMIZATION_PLAN.md).
- [Strategic MVP plan (2025)](../STRATEGIC_MVP_PLAN_2025.md) and
  [platform improvement plan](../PLATFORM_IMPROVEMENT_PLAN.md).
- [Enterprise foundation design proposal](../ENTERPRISE_FOUNDATION_DESIGN_PROPOSAL.md).
- [Roadmap evidence, proposals, and gate materials](roadmap/) — this folder
  contains both product planning and technical evidence; it is not a single
  approved specification.
- [Investor decks](../INVESTOR_DECK_350K.md),
  [V2](../INVESTOR_DECK_V2.md), and [V3](../INVESTOR_DECK_V3.md) are
  presentation materials, not implementation contracts.

## Existing documentation and support locations

- [`docs/roadmap/`](roadmap/) — product maps, gate notes, technical evidence,
  proposals, and runbooks.
- [`security/`](../security/) — dated security notes, SQL verification/repair
  materials, and proposals.
- [`plugins/`](../plugins/) — Vite plugins for share pages, SEO, sitemap, and
  version handling.
- [`scripts/`](../scripts/) — local asset-generation and sanitized-export
  utilities.
- [`remotion/`](../remotion/) — a separate video-rendering package with its own
  README and package files.

Most audit, QA, and release reports still live at the repository root. They
are grouped above by topic for discovery, not moved or reclassified as current.
