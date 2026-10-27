/**
 * Terms of Service, as written by the UX designer (document "Kretopia_Terms_of_Service_2026_v6.html").
 * The text is the document's own. Its internal "before publication" notes are not part of it (see
 * docs/product/LEGAL_PUBLICATION_NOTES.md) and are not shipped.
 */
import type { LegalDocument } from "./types";

export const TERMS: LegalDocument = {
  slug: "terms",
  name: "Terms of Service",
  seoDescription: "The rules for accessing Kretopia, creating a professional record, working with others, using AI-assisted features and supported payment-related services.",
  title: "Terms for",
  accentTitle: "creative work.",
  subtitle: "The rules for accessing Kretopia, creating a professional record, working with others, using AI-assisted features and supported payment-related services.",
  updated: "Last updated 7 October 2026",
  panelHeading: {
    before: "Clear rules for a ",
    accent: "connected system.",
  },
  sections: [
    {
      id: "s01",
      num: "01",
      title: "Agreement to these Terms",
      blocks: [
        {
          type: "p",
          content: [
            "These Terms of Service govern your access to and use of Kretopia and the products, features, websites and services that Kretopia makes available under these Terms (together, the ",
            {
              strong: "“Services”",
            },
            ").",
          ],
        },
        {
          type: "p",
          content: [
            "By creating an account, accessing or using the Services, you agree to these Terms. If you use Kretopia on behalf of an organisation, you represent that you have authority to act for that organisation within the scope you use.",
          ],
        },
        {
          type: "p",
          content: [
            "If you do not agree to these Terms, do not use the Services.",
          ],
        },
      ],
    },
    {
      id: "s02",
      num: "02",
      title: "What Kretopia provides",
      blocks: [
        {
          type: "p",
          content: [
            "Kretopia is being built as an operating environment for creative careers. Depending on availability and release status, the Services may include professional identity and Creative Passport features, opportunity discovery, talent search, collaboration and workspaces, communications, bookings, AI-assisted workflows, payment-related coordination and other professional tools.",
          ],
        },
        {
          type: "p",
          content: [
            "Not every capability is available in every country, account type or release phase. Some features may be labelled beta, early access, planned or otherwise limited.",
          ],
        },
        {
          type: "callout",
          cap: "Product truth matters",
          text: "A description of a planned, preview or beta capability is not a promise that it is available to every user or suitable for every use case.",
        },
      ],
    },
    {
      id: "s03",
      num: "03",
      title: "Eligibility and accounts",
      blocks: [
        {
          type: "p",
          content: [
            "You must provide information that is accurate, current and complete enough for the Services you use. You are responsible for keeping your sign-in credentials secure and for activity conducted through your account, except where applicable law provides otherwise.",
          ],
        },
        {
          type: "p",
          content: [
            "Kretopia is intended for users aged 18 and over. Do not create an account if you are under 18.",
          ],
        },
        {
          type: "p",
          content: [
            "Access to an organisation, project, Work Room, client view or shared record is scoped. Being invited into one workspace or relationship does not give you authority over unrelated records, funds, contacts or organisation settings.",
          ],
        },
      ],
    },
    {
      id: "s04",
      num: "04",
      title: "Professional identity, credits and user content",
      blocks: [
        {
          type: "p",
          content: [
            "You retain ownership of content and materials you submit to Kretopia, subject to rights held by other people and organisations and any separate agreement governing that work.",
          ],
        },
        {
          type: "p",
          content: [
            "You grant Kretopia a non-exclusive licence to host, store, reproduce, process, display and transmit your content only as reasonably necessary to operate, secure, provide and improve the Services, to follow your settings and instructions, and to comply with law.",
          ],
        },
        {
          type: "callout",
          cap: "Your responsibilities",
          text: "You must have the rights and permissions needed for content you upload, publish or share; describe your role and professional claims accurately; avoid fabricated credits, testimonials, evidence or credentials; and respect confidentiality, audience restrictions, privacy and permissions.",
        },
        {
          type: "callout",
          cap: "Evidence stays specific",
          text: "An identity link, collaborator confirmation, client confirmation, published work and transaction evidence do not mean the same thing.",
        },
      ],
    },
    {
      id: "s05",
      num: "05",
      title: "Opportunities, engagements and third parties",
      blocks: [
        {
          type: "p",
          content: [
            "Kretopia may help users discover work, talent, collaborators, services and opportunities. Some opportunities, profiles, links or services may originate from third parties.",
          ],
        },
        {
          type: "p",
          content: [
            "Kretopia does not guarantee that an opportunity is available, that a user will be selected, that another party will perform, or that information supplied by a third party remains current. Where source, freshness, eligibility or outcome is uncertain, that uncertainty may remain visible in the product.",
          ],
        },
        {
          type: "p",
          content: [
            "Unless Kretopia expressly becomes a party to a separate written agreement, contracts for creative services are between the parties who enter them. Users remain responsible for reviewing scope, rights, rates, deliverables, taxes, permissions and other terms relevant to their work.",
          ],
        },
      ],
    },
    {
      id: "s06",
      num: "06",
      title: "Payments, paid features and fees",
      blocks: [
        {
          type: "p",
          content: [
            "Kretopia may offer paid software features and, where supported, payment-related tools for creative work. Availability, payment methods, currencies, provider coverage and financial workflows may vary by country and release status.",
          ],
        },
        {
          type: "callout",
          cap: "Before you commit",
          text: "Applicable subscription price, service fee, processing cost, currency, tax or other charge should be shown before commitment.",
        },
        {
          type: "callout",
          cap: "Payment state",
          text: "A checkout redirect, authorisation, transfer initiation or user-entered status is not by itself proof that money was received or settled.",
        },
        {
          type: "callout",
          cap: "Provider conditions",
          text: "Third-party providers may impose onboarding, identity, compliance, refund, settlement or payout requirements.",
        },
        {
          type: "callout",
          cap: "No universal escrow promise",
          text: "Unless a specific service and applicable law expressly state otherwise, Kretopia is not a bank and does not promise universal escrow, stored-value or money-transmission services.",
        },
      ],
    },
    {
      id: "s07",
      num: "07",
      title: "Kreto and AI-assisted features",
      blocks: [
        {
          type: "p",
          content: [
            "Kreto and other AI-assisted features may help interpret context, prepare drafts, organise information, recommend next actions or perform bounded actions where the product supports them.",
          ],
        },
        {
          type: "p",
          content: [
            "AI output may be incomplete, inaccurate or inappropriate for a particular professional, legal, financial or creative decision. You are responsible for reviewing material outputs before relying on them.",
          ],
        },
        {
          type: "p",
          content: [
            "Where an external action requires approval, permission or authority, the existence of an AI suggestion does not create that authority. Kretopia may require confirmation before consequential actions are executed.",
          ],
        },
      ],
    },
    {
      id: "s08",
      num: "08",
      title: "Acceptable use",
      blocks: [
        {
          type: "p",
          content: [
            "You may not use the Services to violate applicable law or another person’s rights; impersonate, defraud or manipulate evidence; harass or exploit others; gain unauthorised access; scrape personal information without a lawful basis; upload malware; defeat security controls; or use automation for abuse, spam, deception or unauthorised actions.",
          ],
        },
        {
          type: "p",
          content: [
            "Use of Kretopia is also subject to the Community Guidelines where applicable.",
          ],
        },
      ],
    },
    {
      id: "s09",
      num: "09",
      title: "Kretopia intellectual property",
      blocks: [
        {
          type: "p",
          content: [
            "Kretopia and its licensors retain rights in the Platform, software, product design, brand, trademarks, interfaces, documentation and original materials that are not user content. These Terms do not transfer ownership of Kretopia intellectual property to you.",
          ],
        },
        {
          type: "p",
          content: [
            "You may not copy, reverse engineer, resell or exploit protected parts of the Services except as permitted by law, an applicable licence or Kretopia’s written permission.",
          ],
        },
      ],
    },
    {
      id: "s10",
      num: "10",
      title: "Suspension and termination",
      blocks: [
        {
          type: "p",
          content: [
            "You may stop using Kretopia at any time. Account deletion or closure may be subject to retention needed for legal obligations, security, financial reconciliation, disputes, fraud prevention or preservation of records that must remain attributable to other parties.",
          ],
        },
        {
          type: "p",
          content: [
            "Kretopia may restrict, suspend or terminate access where reasonably necessary to address a material breach, protect people or the Services, respond to fraud or security risk, comply with law, or address repeated misuse.",
          ],
        },
        {
          type: "p",
          content: [
            "Where appropriate, narrower restrictions may be used before full termination. Some records may remain available to authorised parties where necessary to preserve an engagement, payment, evidence or legal record.",
          ],
        },
      ],
    },
    {
      id: "s11",
      num: "11",
      title: "Third-party services and disclaimers",
      blocks: [
        {
          type: "p",
          content: [
            "The Services may link to or integrate with third-party websites, payment providers, storage services, communication tools or other external services. Their terms and privacy practices may apply separately.",
          ],
        },
        {
          type: "p",
          content: [
            "To the extent permitted by law, Kretopia provides the Services on an ",
            {
              strong: "“as available”",
            },
            " basis and does not guarantee uninterrupted availability, a particular professional outcome, selection for work, payment by another user, or the accuracy of third-party information.",
          ],
        },
        {
          type: "p",
          content: [
            "Nothing in these Terms excludes rights or warranties that cannot lawfully be excluded.",
          ],
        },
      ],
    },
    {
      id: "s12",
      num: "12",
      title: "Limitation of liability",
      blocks: [
        {
          type: "p",
          content: [
            "To the maximum extent permitted by applicable law, Kretopia will not be liable for indirect, incidental, special, consequential or punitive damages arising from use of or inability to use the Services.",
          ],
        },
        {
          type: "p",
          content: [
            "Any additional limitation, liability cap or mandatory carve-out should be determined by the contracting entity, governing law and the type of service involved.",
          ],
        },
      ],
    },
    {
      id: "s13",
      num: "13",
      title: "Governing law and disputes",
      blocks: [
        {
          type: "p",
          content: [
            "The final governing-law and dispute-resolution clause must identify the correct Kretopia contracting entity and the law and forum that apply to that entity and the relevant users.",
          ],
        },
        {
          type: "p",
          content: [
            "The previous page referred broadly to binding arbitration, but the current product and governance materials do not establish arbitration as Kretopia’s approved dispute model. It has therefore not been carried forward as a settled term.",
          ],
        },
      ],
    },
    {
      id: "s14",
      num: "14",
      title: "Changes to these Terms",
      blocks: [
        {
          type: "p",
          content: [
            "Kretopia may update these Terms as the Services, legal requirements or operating model change. If a change is material, Kretopia should provide notice through the Platform, by email or through another reasonable channel before the change takes effect where required.",
          ],
        },
        {
          type: "p",
          content: [
            "The “Last updated” date at the top of this page identifies the version currently displayed.",
          ],
        },
      ],
    },
    {
      id: "s15",
      num: "15",
      title: "Contact",
      blocks: [
        {
          type: "p",
          content: [
            "Questions about these Terms can be sent to ",
            {
              strong: "legal@kretopia.com",
            },
            ".",
          ],
        },
      ],
    },
  ],
  closing: {
    eyebrow: "Everything about Kretopia",
    heading: {
      before: "Everything about  starts with clarity.",
      accent: "Kretopia",
    },
  },
};
