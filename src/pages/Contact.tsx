import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Handshake,
  Layers3,
  LifeBuoy,
  Mail,
  Pencil,
} from "lucide-react";

import { SEO } from "@/components/SEO";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GlassCtaButton } from "@/components/ui/glass-cta";

import "./Contact.css";

const SUPPORT_EMAIL = "support@kretopia.com";

const TOPICS = [
  { id: "general", label: "General enquiry" },
  { id: "partnership", label: "Partnership" },
  { id: "press", label: "Press & media" },
  { id: "feedback", label: "Product feedback" },
  { id: "support", label: "Support" },
] as const;

type Topic = (typeof TOPICS)[number]["id"];

const CONVERSATIONS = [
  {
    title: "Partnerships",
    description: "Collaborations, programmes and creative partnerships.",
    topic: "partnership" as Topic,
    icon: Handshake,
  },
  {
    title: "Product & experience",
    description: "Ideas, suggestions or feedback on the experience.",
    topic: "feedback" as Topic,
    icon: Layers3,
  },
  {
    title: "Help & support",
    description: "Help with your account or using Kretopia.",
    topic: "support" as Topic,
    icon: LifeBuoy,
  },
];

export default function Contact() {
  const [topic, setTopic] = useState<Topic>("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const selectedTopic =
    TOPICS.find((item) => item.id === topic)?.label ??
    "General enquiry";

  const emailBody = [
    "Hello Kretopia team,",
    "",
    message.trim(),
    "",
    "—",
    `Name: ${name.trim()}`,
    `Email: ${email.trim()}`,
    organisation.trim()
      ? `Organisation: ${organisation.trim()}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const mailto =
    `mailto:${SUPPORT_EMAIL}?` +
    new URLSearchParams({
      subject: `[Kretopia] ${selectedTopic}`,
      body: emailBody,
    }).toString();

  function chooseTopic(next: Topic) {
    setTopic(next);
    setCopied(false);
    setCopyError(false);
  }

  function selectFromAside(next: Topic) {
    chooseTopic(next);

    if (review) {
      setReview(false);
    }

    if (window.matchMedia("(max-width: 900px)").matches) {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      document.getElementById("contact-form-title")
        ?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
    }
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !name.trim() ||
      !email.trim() ||
      message.trim().length < 12
    ) {
      return;
    }

    setReview(true);
    setCopied(false);
    setCopyError(false);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(
        `To: ${SUPPORT_EMAIL}\n` +
        `Subject: [Kretopia] ${selectedTopic}\n\n` +
        emailBody
      );

      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <div className="k-contact">
      <SEO
        title="Contact Kretopia — Start a Conversation"
        description="Questions, partnerships, product feedback or support. Get in touch with the Kretopia team."
      />

      <section className="k-contact__hero">
        <div className="k-contact__container k-contact__hero-grid">
          <div>
            <p className="k-contact__eyebrow">
              Contact
            </p>

            <h1 className="k-contact__title">
              Have something to share?
              <span className="k-gradient-text k-contact__gradient">
                We're listening.
              </span>
            </h1>

            <p className="k-contact__lead">
              A question, an idea, or a chance to work together?
              We'd love to hear from you.
            </p>

            <p className="k-contact__description">
              Tell us what you're reaching out about. We'll help you
              prepare an email you can review before sending.
            </p>
          </div>

          <div className="k-contact__direct">
            <p className="k-contact__eyebrow">Email us directly</p>

            <a
              className="k-contact__email"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>

            <p className="k-contact__direct-note">
              Opens your email app.
            </p>
          </div>
        </div>
      </section>

      <section className="k-contact__main">
        <div className="k-contact__container k-contact__columns">
          <section
            className="k-contact__panel"
            aria-labelledby="contact-form-title"
          >
            <div className="k-contact__panel-heading">
              <p className="k-contact__eyebrow">
                Your message
              </p>

              <h2 id="contact-form-title">
                {review
                  ? "Review your email."
                  : "Tell us a little more."}
              </h2>

              <p className="k-contact__muted">
                {review
                  ? "Check the details before opening your email app."
                  : "Have a question, an idea, or something you'd like to share? Tell us about it."}
              </p>
            </div>

            {!review ? (
              <form
                className="k-contact__form"
                onSubmit={handleReview}
              >
                <fieldset className="k-contact__topic-fieldset">
                  <legend>What would you like to discuss?</legend>

                  <div className="k-contact__topics">
                    {TOPICS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="k-contact__topic"
                        aria-pressed={topic === item.id}
                        onClick={() => chooseTopic(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="k-contact__fields-row">
                  <div className="k-contact__field-group">
                    <label htmlFor="contact-name">
                      Your name *
                    </label>

                    <Input
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="Your full name"
                      maxLength={120}
                      className="k-contact__input"
                      required
                    />
                  </div>

                  <div className="k-contact__field-group">
                    <label htmlFor="contact-email">
                      Email address *
                    </label>

                    <Input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      placeholder="you@example.com"
                      maxLength={254}
                      className="k-contact__input"
                      required
                    />
                  </div>
                </div>

                <div className="k-contact__field-group">
                  <label htmlFor="contact-organisation">
                    Organisation{" "}
                    <span className="k-contact__optional">
                      (optional)
                    </span>
                  </label>

                  <Input
                    id="contact-organisation"
                    name="organisation"
                    autoComplete="organization"
                    value={organisation}
                    onChange={(event) =>
                      setOrganisation(event.target.value)
                    }
                    placeholder="Studio, company or collective"
                    maxLength={160}
                    className="k-contact__input"
                  />
                </div>

                <div className="k-contact__field-group">
                  <label htmlFor="contact-message">
                    Your message *
                  </label>

                  <Textarea
                    id="contact-message"
                    name="message"
                    value={message}
                    onChange={(event) =>
                      setMessage(event.target.value)
                    }
                    placeholder="What would you like us to know?"
                    minLength={12}
                    maxLength={2500}
                    rows={6}
                    className="k-contact__textarea"
                    aria-describedby="contact-message-help"
                    required
                  />

                  <div
                    className="k-contact__field-hint"
                    id="contact-message-help"
                  >
                    <span>A little context helps. Minimum 12 characters.</span>
                    <span>
                      {message.length.toLocaleString()} / 2,500
                    </span>
                  </div>
                </div>

                <div className="k-contact__actions">
                  <p className="k-contact__fine-print">
                    Nothing is sent or stored here. After reviewing, select Open email app to send your message.
                  </p>

                  <GlassCtaButton type="submit" size="md">
                    Review email draft
                  </GlassCtaButton>
                </div>
              </form>
            ) : (
              <div className="k-contact__review">
                <div className="k-contact__review-meta">
                  <span>To</span>
                  <strong>{SUPPORT_EMAIL}</strong>

                  <span>Subject</span>
                  <strong>
                    [Kretopia] {selectedTopic}
                  </strong>
                </div>

                <pre className="k-contact__review-body">
                  {emailBody}
                </pre>

                <p className="k-contact__fine-print">
                  Nothing has been sent. Select Open email app to create a draft, then send it yourself.
                </p>

                <div className="k-contact__review-actions">
                  <button
                    type="button"
                    className="k-contact__text-button"
                    onClick={() => setReview(false)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                    Edit message
                  </button>

                  <button
                    type="button"
                    className="k-contact__text-button"
                    onClick={copyDraft}
                  >
                    {copied ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Copy size={16} aria-hidden="true" />
                    )}
                    {copied ? "Copied" : "Copy draft"}
                  </button>

                  <a
                    className="k-contact__send-link"
                    href={mailto}
                  >
                    <Mail size={16} aria-hidden="true" />
                    Open email app
                    <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </div>

                {copyError && (
                  <p
                    className="k-contact__error"
                    role="alert"
                  >
                    Copying was unavailable. You can
                    select the message above or open
                    your email app.
                  </p>
                )}
              </div>
            )}
          </section>

          <aside
            className="k-contact__aside"
            aria-labelledby="contact-topics-title"
          >
            <p className="k-contact__eyebrow">
              One team, many ways to connect
            </p>

            <h2 id="contact-topics-title">
              Let's find the right conversation.
            </h2>

            <p className="k-contact__muted">
              Select a category to set your message topic.
            </p>

            <div className="k-contact__conversation-list">
              {CONVERSATIONS.map(
                ({
                  title,
                  description,
                  topic: value,
                  icon: Icon,
                }) => (
                  <button
                    key={value}
                    type="button"
                    className="k-contact__conversation"
                    aria-pressed={topic === value}
                    onClick={() => selectFromAside(value)}
                  >
                    <Icon size={20} aria-hidden="true" />

                    <span className="k-contact__conversation-copy">
                      <strong>{title}</strong>
                      <span>{description}</span>
                    </span>

                    <ArrowRight
                      className="k-contact__conversation-arrow"
                      size={17}
                      aria-hidden="true"
                    />
                  </button>
                ),
              )}
            </div>

            <p className="k-contact__aside-note">
              For media enquiries, choose{" "}
              <button
                type="button"
                onClick={() => selectFromAside("press")}
              >
                Press & media
              </button>{" "}
              in the form.
            </p>
          </aside>
        </div>
      </section>

      <EditorialFooter />
    </div>
  );
}
