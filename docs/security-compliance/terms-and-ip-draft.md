# Terms and IP — Draft Outline

> ## DRAFT — REQUIRES LEGAL REVIEW
> This is a structural outline for counsel. It is **not legal advice**, not a contract, and not ready to publish. Every clause below needs review by qualified counsel in each operating jurisdiction before use. Capitalised terms are placeholders.

**Status:** Internal draft · 2026-11-13
**Context:** the live Terms (`src/content/legal/terms.ts`) and Privacy Policy (`src/content/legal/privacy.ts`) exist but are flagged by their own authors as not ready to publish (`docs/product/LEGAL_PUBLICATION_NOTES.md:2-26`). This outline covers the gaps most relevant to the mentor review: project ownership, contributor IP, confidentiality, acceptable use, liability, termination and disputes.

**How to use this document:** sections 1–7 are the outline. Section 8 lists decisions that must be made before drafting. Section 9 lists the product changes that would make the terms true.

---

## 1. Project ownership

**Objective:** make it unambiguous that the host retains project IP unless a written agreement says otherwise.

Draft headings and intent:

1.1 **Definitions**
- "Host" — the user or company that creates and owns a Studio project.
- "Contributor" — any user granted access to a project.
- "Project Materials" — briefs, files, deliverables, comments, and other content uploaded to or created within a project.
- "Pre-existing Work" — anything a party owned before the project or develops outside it.

1.2 **Default ownership rule**
- The Host retains all right, title and interest in the project, its brief, and Project Materials commissioned under it, subject to Contributors' Pre-existing Work and third-party rights.
- A Contributor assigns (or, where assignment is ineffective, grants an exclusive licence to) its project-specific deliverables to the Host **on full payment** of the agreed fee, unless the project terms state otherwise.
- **[LEGAL REVIEW REQUIRED]** whether assignment or licence is the correct mechanism in each jurisdiction, and how moral rights are handled.

1.3 **Project container vs. project output**
- Kretopia owns the platform, the project container, templates and system-generated structure.
- The Host owns the content inside it.
- Deleting a project does not transfer ownership of output already delivered.

1.4 **Retention and access after engagement**
- The Host controls project retention.
- A Contributor's access ends when removed; the Host keeps the delivered output.
- Data export window and deletion process (see section 6).

1.5 **Embedded third-party material**
- A Contributor warrants it has cleared fonts, music, footage, stock and AI-generated assets.
- The Host's rights are limited by those third-party licences.

---

## 2. Contributor IP

2.1 **Pre-existing Work**
- Each party retains ownership of its Pre-existing Work.
- A Contributor grants the Host a non-exclusive, worldwide, royalty-free licence to use Pre-existing Work **only as embedded in the project**.
- The Contributor must identify Pre-existing Work before delivery.

2.2 **Licence back to the platform**
- A limited licence to host, store, display, back up and process Project Materials to operate the service.
- No ownership transfer to Kretopia.
- Whether the licence permits model training must be stated explicitly. **[LEGAL REVIEW REQUIRED]**

2.3 **AI-assisted output**
- A Contributor must disclose material AI-generated content where required.
- The Contributor is responsible for the rights position of AI-assisted output it delivers.
- Kretopia does not warrant that AI output is original or non-infringing. **[LEGAL REVIEW REQUIRED]**

2.4 **Moral rights**
- To the extent permitted by law, a waiver or agreed treatment of attribution and integrity rights. **[LEGAL REVIEW REQUIRED]** (may be unwaivable in some jurisdictions.)

2.5 **Contributor representations**
- The Contributor has authority to grant the rights; the work is not infringing; no conflicting exclusivity.

2.6 **Platform contributors (people who build Kretopia)**
- A separate contributor/contractor agreement is needed if the platform accepts external code or content contributions. None exists today. **[LEGAL REVIEW REQUIRED]**

---

## 3. Confidentiality

3.1 **Definition** — non-public project information, briefs, rates, unreleased work, personal data, credentials.
3.2 **Obligations** — use only for the project; no disclosure except to necessary personnel or advisers under equivalent obligations.
3.3 **Carve-outs** — public, independently developed, lawfully received, legally compelled (with notice where permitted).
3.4 **Duration** — during the project and for a defined period after; trade secrets for as long as they remain secret.
3.5 **Return/destruction** — on request, subject to backups and legal retention.
3.6 **Platform confidentiality** — Kretopia's handling of project data is governed by the Privacy Policy, not this clause. **[LEGAL REVIEW REQUIRED]**

---

## 4. Acceptable use

4.1 **Prohibited content** — unlawful, infringing, misleading, harassing, hateful, sexual content involving minors, malware.
4.2 **Prohibited conduct** — impersonation, scraping, credential sharing, bypassing access controls, spam, fraud, sanctions evasion, money laundering.
4.3 **AI-specific rules**
- No using agents to send unsolicited bulk messages.
- No attempting to extract other users' data through prompts.
- Disclosure of automated interaction where required.
- No use of the service to make automated decisions about individuals without a lawful basis. **[LEGAL REVIEW REQUIRED]**
4.4 **Enforcement** — warning, removal, suspension, termination; appeal route.
4.5 **Reporting** — abuse and IP-infringement contact and takedown process. **[LEGAL REVIEW REQUIRED]** on notice-and-takedown regime.

---

## 5. Liability

5.1 **Service availability** — provided "as is" to the extent permitted; no uptime warranty unless separately agreed.
5.2 **Exclusion of indirect/consequential loss** — subject to what is unenforceable.
5.3 **Liability cap** — a defined multiple of fees paid in the preceding period, or a fixed sum. **[LEGAL REVIEW REQUIRED]**
5.4 **Non-excludable liability** — fraud, death/personal injury, gross negligence, mandatory consumer rights. **[LEGAL REVIEW REQUIRED]**
5.5 **User-to-user disputes** — Kretopia is not a party to engagements between users; it provides tooling only, except where it acts as a payment facilitator.
5.6 **Payment-provider role** — the platform is not a bank; a redirect or auth is not proof of payment (already asserted at `src/content/legal/terms.ts:171-183`).
5.7 **AI output** — no warranty of accuracy; user must review before relying.
5.8 **Indemnity** — user indemnifies for infringing content and unlawful use. **[LEGAL REVIEW REQUIRED]**

---

## 6. Termination

6.1 **By the user** — close the account; export window; what is deleted vs. retained.
6.2 **By Kretopia** — breach, risk, legal requirement, inactivity; notice where practicable.
6.3 **Effect on projects**
- Active projects: contributors' access ends; delivered output and acceptance records retained.
- Ongoing engagements: the parties must settle directly; Kretopia may hold funds only as documented.
6.4 **Data after termination**
- Export window, deletion schedule, and record-retention exceptions (payment, tax, dispute, fraud). **[LEGAL REVIEW REQUIRED]**
- The current UI claims permanent deletion but the deletion path does not work (see `data-protection-review.md` DP-01). Do not publish a deletion promise until it is true.
6.5 **Survival** — IP, confidentiality, liability, dispute clauses.

---

## 7. Dispute handling

7.1 **User-to-user disputes** — direct negotiation first; platform-assisted evidence (deliverable history, messages, acceptance record) on request.
7.2 **Payment disputes** — chargeback and provider process; account restriction during investigation.
7.3 **Platform disputes** — notice of issue, good-faith negotiation period, then courts or arbitration.
7.4 **Governing law and forum** — to be completed. **[LEGAL REVIEW REQUIRED]**
7.5 **Consumer forum rights** — mandatory local rights preserved. **[LEGAL REVIEW REQUIRED]**
7.6 **Evidence** — the audit trail required by `docs/platform/AUDIT_TRAIL_DESIGN.md` is a prerequisite for running 7.1 credibly. It does not exist yet.

---

## 8. Decisions required before drafting

| # | Decision | Why it blocks drafting |
|---|---|---|
| 1 | Contracting entity, registered address, governing law, forum | Cannot identify the counterparty or the forum |
| 2 | Liability cap and carve-outs | Core commercial term |
| 3 | Default project IP rule and assignment mechanism | Section 1/2 cannot be written without it |
| 4 | Whether AI output ownership/training is addressed | Section 2.3 and privacy notice |
| 5 | Refund/withdrawal policy per product type | Consumer law and payment flows |
| 6 | Whether the wallet balance is e-money | Determines the regulatory characterisation |
| 7 | Data-retention periods and deletion promise | Section 6.4 and privacy policy |
| 8 | Sanctions/eligibility restrictions and country availability | Section 4 and payment gating |
| 9 | DPO/representative requirement | Privacy notice contact block |

---

## 9. Product changes required to make the terms true

| Proposed term | Product gap | Where |
|---|---|---|
| Host-only acceptance | Any member can approve a deliverable | `supabase/migrations/20260211050740_*.sql:116` |
| Contributor IP metadata (pre-existing work disclosure) | No field or flow | contract builder only (`ContractBuilder.tsx:26-49`) |
| Terms acceptance record | No clickwrap, no timestamp, no version | not found in `src/` or migrations |
| Project retention and export | No retention setting or export-on-exit | not found |
| Confidentiality enforcement | No per-project confidentiality flag | not found |
| Real account deletion | Client-side admin call cannot succeed | `src/pages/Settings.tsx:439`; `SettingsTab.tsx:184` |
| Dispute evidence | No general audit table | `docs/platform/AUDIT_TRAIL_DESIGN.md:1-8` |
| Sanctions/eligibility | No screening control | see `payments-credits-ip-review.md` §5 |

---

## 10. Prioritised remediation list

### P0
| ID | Action | Why now |
|---|---|---|
| TERMS-01 | Replace the broken deletion promise with a truthful flow, and do not publish a deletion timeline until server-side erasure works | Current UI claims deletion that cannot occur |
| TERMS-02 | Decide the default project-IP rule and record it as a product setting, not a blank contract field | Ownership is the core of the mentor's IP concern |
| TERMS-03 | Make deliverable acceptance host-only | Any member can currently accept on the host's behalf |

### P1
| ID | Action |
|---|---|
| TERMS-04 | Terms-acceptance record with version and timestamp |
| TERMS-05 | Contributor IP / pre-existing work disclosure flow |
| TERMS-06 | Confidentiality flag and project retention/export setting |
| TERMS-07 | Legal review and completion of sections 1–7 |
| TERMS-08 | Align privacy policy, terms and actual product behaviour (AI training, cookies, retention) |

### P2
- Contributor/contractor agreement for platform contributors.
- IP takedown and notice process.
- Country availability and sanctions language aligned with payment gating.

---

## 11. Publication checklist (all items open)

- [ ] **DRAFT — REQUIRES LEGAL REVIEW** sign-off on sections 1–7
- [ ] Contracting entity and address inserted
- [ ] Governing law and forum inserted
- [ ] Liability cap inserted
- [ ] Consumer-law carve-outs reviewed for each market
- [ ] AI/model-training position decided and stated
- [ ] Deletion timeline matches what the product can do
- [ ] Cookie/analytics inventory matches the live site
- [ ] Contact mailboxes confirmed monitored
- [ ] Terms-acceptance capture implemented and versioned
- [ ] Privacy policy and terms cross-referenced and consistent
- [ ] Country availability and payment restrictions consistent with the code

> **DRAFT — REQUIRES LEGAL REVIEW.** Nothing in this outline should be published or relied upon without qualified counsel.
