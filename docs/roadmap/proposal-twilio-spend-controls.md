# Proposal: Twilio spend and rate controls

Proposal only. **Nothing here was applied, and nothing here is runnable.** No provider is created, no limit is changed in the Twilio console by this document, and no credential is read or shown.

Covers the SMS and WhatsApp verification sender (`send-phone-otp`) and any future Twilio use. Matrix row 13; the program item "Twilio spend/rate controls".

## 0. Prerequisite: capture the live state (read-only)

- from the Twilio console, by someone with access: the account's usage and spend by day for the last 60 days, the messaging geo-permissions currently enabled, the configured usage triggers and the account's monthly spend cap if any;
- from the database: counts (numbers only) of `profiles` rows with a non-null `phone_otp_expires_at` by day, to compare against Twilio's message count;
- the list of functions that read `TWILIO_*` (today only `send-phone-otp`).

## 1. Objects affected and current unsafe behaviour

| # | Object | Behaviour today |
|---|---|---|
| T-A | `send-phone-otp` | the only Twilio caller. Before PR #162 any signed-in account could send unlimited SMS or WhatsApp codes to any number (SMS pumping). PR #162, once pasted, adds a 60 second cooldown per account, a number format check and hashed, guess-limited codes |
| T-B | account level | no per-day, per-account or per-country bound anywhere in our code; the control that remains is whatever the Twilio account is configured with |
| T-C | destination | any country in the Twilio account's geo-permissions can be targeted; premium and high-cost routes are the classic pumping destination |
| T-D | accounts | a free account can be created in bulk, so a per-account cooldown does not bound spend |

## 2. Target

1. A hard monthly and daily **spend ceiling at the provider**, so the worst case is a number the owner chose, whatever the code does.
2. Messaging **geo-permissions** limited to the countries Kretopia actually serves.
3. In our code, a bound per account per day and per destination country, plus a global per-hour ceiling that fails closed (users see "try again later"; nothing is sent).
4. An alert before the ceiling, not after.
5. Verification codes are only sent to a signed-in account whose email is verified and which is older than a minimum age (to blunt bulk-created accounts).

## 3. Controls

| Layer | Control | Where it lives | Needs approval |
|---|---|---|---|
| Provider | monthly spend cap and usage-trigger alerts | Twilio console | owner action (no code) |
| Provider | geo-permissions allow-list; disable high-risk and premium destinations; enable the provider's fraud guard (SMS pumping protection) if the plan offers it | Twilio console | owner action |
| Code | per account per day (for example 5 codes), per destination country per hour (a configurable number), global per hour ceiling | `send-phone-otp`, reading the durable registry of `proposal-outbound-send-registry.md` | after that proposal |
| Code | minimum account age and verified email before a code is sent | `send-phone-otp` | code PR |
| Code | WhatsApp only to numbers the user typed in the same session (no batch), unchanged | `send-phone-otp` | none |
| Observability | a daily count of sends by country in the registry, an alert when a country's count jumps | registry plus the existing admin tooling | after the registry |

## 4. Sketches (NOT RUNNABLE, for review of intent only)

```
-- registry rows of channel 'sms' and 'whatsapp' carry <recipient_scope> = the E.164 country prefix
-- limits (data, not code), in the registry's limits table:
--   channel sms|whatsapp, kind otp:  per_actor 5 per day, 1 per 60 s;  global 200 per hour (decision 2)
--   per scope: <scope> 20 per hour (decision 3)
-- send-phone-otp: reserve -> over a limit: answer 429 and send nothing; the provider cap is the last line.
```

## 5. Data migration, backfill and compatibility

None for the console steps. The code steps depend on the registry; until it exists the 60 second cooldown stays the only code-level bound, which is why the console controls come first.

## 6. RLS impact by role

None: no table is read or written by a client.

## 7. Decisions needed from the approver

1. **The monthly spend ceiling** and the alert thresholds (a number, in the owner's currency).
2. **The global hourly ceiling** (a placeholder of 200 above) and what the user sees when it trips.
3. **The country allow-list.** Which countries Kretopia verifies phones in.
4. **Minimum account age** before a code can be sent (for example 10 minutes), and whether a verified email is required.
5. **WhatsApp**: keep or disable until the template and sender are approved on the provider side.

## 8. Rollout sequence

1. Section 0 capture.
2. The owner sets the spend cap, geo-permissions and alerts in the Twilio console (no code, immediate, reversible).
3. Code PR: minimum age and verified email (small, pasted manually).
4. After the registry exists: per-account, per-country and global limits.
5. A week of country counts reviewed.

## 9. Rollback

Console settings are changed back by the owner. Code limits are removed by re-pasting the previous `send-phone-otp`. A provider cap that is too low shows as failed sends (visible in the response and in Twilio), not as a silent loss.

## 10. Tests required before each code step

Roles: a verified user, a new unverified account, a second account, anonymous.

| Case | Expected |
|---|---|
| a verified user, first code of the day | sent |
| the same user, sixth code in a day | 429, nothing sent |
| an account created a minute ago | refused with a clear message |
| anonymous | 401 |
| the global ceiling reached | 429 for everyone, nothing sent, an alert |
| provider cap reached | Twilio refuses, the response is an error, the stored code is cleared (already in #162) |

## 11. Estimated blast radius

Console changes: none on code; a cap set too low blocks legitimate verification until raised. Code: users who verify a phone (a small, self-selected group); the visible failure is a retry message.

## 12. Not in scope

Other SMS use cases (none exist), the email budget (registry proposal), changing provider, fraud scoring.
