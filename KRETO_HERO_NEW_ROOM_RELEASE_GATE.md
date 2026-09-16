# Kreto Hero + New Room Release Gate

Roll-up of this audit pass against the brief's §12 exit criteria.

## Gate checklist

| Criterion | Status |
|---|---|
| Reference rights/originality documented | `AUDITED` — `KRETO_HERO_AND_NEW_ROOM_REFERENCE_REPORT.md`. Reference classified `UNKNOWN_RIGHTS_ORIGIN`; existing `KretoPresence` design already correctly diverges and needs no rights-driven redesign. |
| Kreto original and Kretopia-native | Holds, unchanged from prior audits. |
| Landing Hero preserves title/CTA priority | Holds today (desktop). Any new scene work (Gap 2) must preserve this and be re-verified — not yet built. |
| No robot roams randomly across Landing | Holds — one Hero instance only; `KRETO_SURFACE_PLACEMENT_MAP.md` (prior pass) already confirms no other Landing section has a `KretoPresence`/`KretoMark` instance today, and this brief's own §3 limited-rollout list (product loop, final CTA) is `NOT_STARTED`, not something to add without its own approval. |
| New Room state mapping reflects real behavior | Partially ready. `idle`/`attentive`/`processing`/`proposal_ready` map cleanly to real `mode` transitions already in `VoiceFirstCreateModal.tsx`. `listening` needs a new state added to `KretoPresence`. `caution`/`success`/`error` each need one explicit product decision before implementation (see `KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md`) — none is a rights or technical blocker, each is a real choice about which UX moment the state should represent. `offline` has no real signal to attach to yet, same finding as the prior pass. |
| No fake listening/processing/success | No fake states exist today (nothing was implemented this pass); the mapping audit is specifically designed to prevent one being introduced later (e.g. flagging that `listening` must never trigger from the `catch` branch of `startRecording()`). |
| No CTA/input obstructed | Audited and clear for every proposed placement (`KRETO_HERO_SCENE_REPORT.md`, `KRETO_NEW_ROOM_INTEGRATION_REPORT.md`) — nothing implemented yet to obstruct anything. |
| Day/Night passes | Not applicable yet (nothing new built); existing Hero badge previously verified. |
| Reduced motion passes | Not applicable yet; existing Hero badge previously verified, new work must route through the same `useReducedMotion()` hook. |
| Accessibility passes | Foundations audited and sound (`KRETO_HERO_NEW_ROOM_ACCESSIBILITY_REPORT.md`) — New Room's existing focus-trap/Escape/focus-return needs no rebuilding; nothing new to verify yet. |
| Performance does not regress | Budget and method established (`KRETO_HERO_NEW_ROOM_PERFORMANCE_REPORT.md`); nothing measured yet since nothing shipped. |
| Tests pass | No new tests were needed for a read-only audit; existing suite (32/32 from the prior pass) is unaffected — this pass touched no component code. |
| Browser verification passes | `NOT_STARTED` (`KRETO_HERO_NEW_ROOM_BROWSER_MATRIX.md`) — correctly, since nothing was implemented. |
| No privacy/security issue | Clear — the Hero scene's fragments are explicitly scoped to abstract shapes only (no real user data, names, or metrics per the brief's own §2 rule), and New Room's integration reuses existing real triggers without adding any new data collection. |

## Final status

```text
KRETO_HERO_NEW_ROOM_AUDIT_COMPLETE
```

This pass is read-only, as instructed: no component code was changed. Four concrete, independently-approvable next steps came out of the audit:

1. **New Room — add `listening` to `KretoPresence`, wire `idle`/`attentive`/`listening`/`processing`/`proposal_ready`.** Lowest-risk, highest-clarity next step: every one of these states has a clean, unambiguous, already-instrumented real trigger.
2. **New Room — decide `caution`/`success`/`error` triggers.** Needs your call on the three open questions in `KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md` (which "needs review" moment counts as `caution`; whether `success` shows in this modal or on the destination page; whether `error` gets a visual state at all or stays toast-only) before implementation.
3. **Hero — CTA-linked `attentive` + scroll transition.** Small, additive, no open product questions — implementable directly.
4. **Hero — mobile/tablet placement and the full narrative scene.** The largest remaining item; recommend scoping and approving it as its own dedicated pass, the same way the original Signal Field redesign was.

Awaiting direction on which of these (if any) to implement next.
