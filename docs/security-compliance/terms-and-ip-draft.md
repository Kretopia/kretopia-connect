# Terms and IP: draft

> **Draft. Requires legal review before any use.** This is not legal advice, it is not final wording, and nothing here has been added to the product. It is written in plain language so counsel can turn it into terms. Whether these terms are enforceable, sufficient or appropriate in a given country is for counsel to decide.

## 1. Where users accept terms, invite, share or approve today

| Moment | Where in the product | What the user sees about terms today |
|---|---|---|
| Sign-up | authentication pages and onboarding | No acknowledgement found on the main sign-up; one onboarding claim step says "By continuing you agree to our Terms & Privacy Policy" (`src/components/onboarding/claim-flow/EmailSaveStep.tsx:224`). Nothing is recorded |
| Marketplace listing | `src/components/marketplace/CreateListingDialog.tsx:377` | A checkbox: "I agree to the marketplace terms…" |
| Inviting a collaborator, client or guest | invitation dialogs in Studio | No terms |
| Accepting an invitation | `accept-project-invitation` | No terms |
| Opening a project as a guest through a share link | `redeem-project-share` | No terms |
| Sharing files in a project | project files and boards | No terms |
| Approving a deliverable or a milestone | Studio money and deliverables | No statement of what approval means for ownership or payment |
| Paying an invoice or a payment link | public pay pages, Stripe Checkout | Stripe's terms; no Kretopia statement |
| RSVP to an event (members and guests) | event page and guest RSVP form | No terms |

Recommendation: record the terms and privacy versions each person accepts, with the time (sign-up, accepting an invitation, guest access, marketplace listing).

## 2. Product-facing ownership explanation (draft copy)

For a "How ownership works" panel in a project's settings and the invitation screen. Short, not legalistic.

> **Who owns what in a project**
>
> - **The host owns the project.** The person who created the project runs it: its settings, who is in it, what is delivered and paid. That stays with the host unless you agree something else in writing.
> - **You keep your own work.** Anything you made before joining, your samples, presets, templates, style and know-how, stays yours. Using it in this project does not give it away.
> - **What you make for the project** is shared as you and the host agree. If you have not agreed anything, talk about it before you deliver. Kretopia does not decide it for you.
> - **Your Credit is yours.** The record that you did a role on this project belongs on your Passport, whoever owns the project.
> - **Approving a deliverable** means the host accepts it as delivered. It is not, on its own, a transfer of rights.
> - **Clients and guests** see what the host shares with them. They do not own the project or its files by being invited.
>
> These are Kretopia's defaults, not legal advice. For anything that matters, put the deal in writing.

## 3. What a buyer is paying for (draft copy)

> When you pay on Kretopia you are paying for a role or a job on a project: a milestone, an invoice, a ticket. You are not buying a currency or a Credit. Credits are records of the work people did; they cannot be bought, sold or transferred.

## 4. Collaboration terms outline (for counsel)

1. **Parties and roles**: host (project owner), collaborators and creatives, clients, guests; Kretopia as a platform, not a party to the project.
2. **Ownership**: the host owns the project and its settings; default treatment of deliverables when nothing else is agreed (counsel to choose: assignment on payment, licence, or no default); each contributor keeps rights in pre-existing work and general know-how; moral rights and attribution (Credits).
3. **Licences to Kretopia**: what Kretopia may do with uploaded content to run the service (store, display to the people it is shared with, process with AI features the user turns on); no use for training models unless the user opts in.
4. **Confidentiality**: project content is confidential to its members; exceptions (already public, required by law); duration.
5. **Acceptable use**: no unlawful content, no infringing material, no harassment, no spam, no scraping, no attempts to bypass security or approval, no use of agents to contact people who have not agreed to it; link to the community guidelines.
6. **AI features**: AI output may be wrong; the user reviews before sending or relying on it; actions that send, publish, invite or pay require the user's approval.
7. **Payments**: what is bought (a role or a job), fees, refunds and disputes, payouts through the payment provider, holds and limits, taxes are the users' responsibility, manually recorded payments are the issuer's statement.
8. **Liability**: platform provided as is; limits of Kretopia's liability; each party responsible for its own deliverables and promises to others.
9. **Termination**: leaving a project (what happens to files and Credits), removing a member (host only), closing an account (data export and deletion).
10. **Disputes**: first between the parties; Kretopia's role (records, not a judge); payment disputes through the payment provider; governing law and venue (counsel).
11. **Changes to terms**: notice and acceptance of new versions.

## 5. Privacy and data notes for counsel

- Kretopia acts as a controller for accounts and profiles, and probably as a processor for content a host puts in a project on behalf of a business client: a customer-facing data processing agreement may be needed.
- Processors and transfers are listed in `data-protection-review.md` §1.
- Public-presence search and AI ranking of named people need a lawful-basis assessment and probably a DPIA.
