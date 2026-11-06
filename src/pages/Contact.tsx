import { KretopiaIcon } from "@/components/pricing/KretopiaIcon";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { useRef, useState, type FormEvent } from "react";
import { Handshake, LifeBuoy, Layers } from "lucide-react";
import { SEO } from "@/components/SEO";
import { EditorialFooter } from "@/components/landing/kretopia/EditorialFooter";
import { GlassCtaButton, OutlineCtaButton } from "@/components/ui/glass-cta";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./Contact.css";

const TOPICS = ["General enquiry", "Partnership", "Press & media", "Product feedback", "Support"] as const;
type Topic = typeof TOPICS[number];
type Field = "name" | "email" | "organization" | "message";
type Errors = Partial<Record<Field, string>>;
const STARTING_POINTS = [
  { topic: "Partnership", title: "Partnerships", description: "Collaborations, programmes and opportunities.", icon: Handshake },
  { topic: "Product feedback", title: "Product & experience", description: "Ideas, questions or feedback about Kretopia.", icon: Layers },
  { topic: "Support", title: "Help & support", description: "Account or technical assistance.", icon: LifeBuoy },
] as const;


const CONTACT_PUBLIC_TUTORIAL = [
  {
    title: "Choose your topic",
    body: "Select General enquiry, Partnership, Press & media, Product feedback or Support."
  },
  {
    title: "Write your message",
    body: "Enter your name, email address and message. Organisation is optional."
  },
  {
    title: "Review your draft",
    body: "Check your message before opening your email application. The form does not send or save it."
  },
  {
    title: "Send from your email app",
    body: "Open the prepared email and send it from your own email application."
  }
];

export default function Contact() {
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", organization: "", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ text: "", href: "" });
  const [copyStatus, setCopyStatus] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);

  function update(field: Field, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  function chooseTopic(value: Topic) {
    setTopic(value);
    document.getElementById("contact-form")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true }));
  }

  function prepareMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const nextErrors: Errors = {};
    if (values.name.trim().length < 2) nextErrors.name = "Please enter your name (at least 2 characters).";
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    if (!values.email.trim() || !emailInput.checkValidity()) nextErrors.email = "Please enter a valid email address.";
    if (values.message.trim().length < 12) nextErrors.message = "Please write at least 12 characters.";
    setErrors(nextErrors);
    const firstError = (Object.keys(nextErrors) as Field[])[0];
    if (firstError) {
      (form.elements.namedItem(firstError) as HTMLElement)?.focus();
      return;
    }
    const text = `Topic: ${topic}\nName: ${values.name.trim()}\nEmail: ${values.email.trim()}${values.organization.trim() ? `\nOrganisation: ${values.organization.trim()}` : ""}\n\nMessage:\n${values.message.trim()}`;
    setDraft({ text, href: `mailto:support@kretopia.com?subject=${encodeURIComponent(`Kretopia — ${topic}`)}&body=${encodeURIComponent(text)}` });
    setCopyStatus("");
    setOpen(true);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopyStatus("Message copied. Nothing has been sent.");
    } catch {
      previewRef.current?.focus();
      previewRef.current?.select();
      setCopyStatus("Copy the selected text using your device’s copy command.");
    }
  }

  return (
    <div className="k-contact">
      <SEO title="Contact the team — Kretopia" description="Questions, ideas, feedback or opportunities. Start a conversation with the Kretopia team." />


      <FeaturePageHeader
        eyebrow="CONTACT / START A CONVERSATION"
        title="What's on your mind?"
        accentTitle="We're listening."
        subtitle="Questions, ideas, partnerships or support. Choose how you'd like to reach the Kretopia team."


        tutorial={{ featureKey: "public-contact", label: "How to contact the team", steps: CONTACT_PUBLIC_TUTORIAL }}
      />

      <section className="k-contact__section" aria-labelledby="contact-heading">
        <div className="k-contact__container k-contact__layout">
          <div className="k-contact__panel" id="contact-form">
            <p className="landing-eyebrow">01 / CONTACT THE TEAM</p>
            <h2 id="contact-heading" className="landing-h2 k-contact__heading">Prepare your message.</h2>

            <form onSubmit={prepareMessage} noValidate className="k-contact__form">
              <fieldset className="k-contact__topics">
                <legend>What's this about?</legend>
                <div className="k-contact__topic-list">
                  {TOPICS.map(value => <label key={value} className="k-contact__topic">
                    <input type="radio" name="topic" value={value} checked={topic === value} onChange={() => setTopic(value)} />
                    <span>{value}</span>
                  </label>)}
                </div>
              </fieldset>
              <div className="k-contact__fields">
                <div className="k-contact__field">
                  <Label htmlFor="contact-name">Your name <span aria-hidden="true">*</span></Label>
                  <Input ref={nameRef} id="contact-name" name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Full name" value={values.name} onChange={e => update("name", e.target.value)} error={!!errors.name} aria-describedby={errors.name ? "contact-name-error" : undefined} />
                  {errors.name && <p id="contact-name-error" className="k-contact__error" role="alert">{errors.name}</p>}
                </div>
                <div className="k-contact__field">
                  <Label htmlFor="contact-email">Email address <span aria-hidden="true">*</span></Label>
                  <Input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={180} placeholder="you@example.com" value={values.email} onChange={e => update("email", e.target.value)} error={!!errors.email} aria-describedby={errors.email ? "contact-email-error" : undefined} />
                  {errors.email && <p id="contact-email-error" className="k-contact__error" role="alert">{errors.email}</p>}
                </div>
                <div className="k-contact__field k-contact__full">
                  <Label htmlFor="contact-organization">Organisation <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="contact-organization" name="organization" autoComplete="organization" maxLength={150} placeholder="Studio, company, collective…" value={values.organization} onChange={e => update("organization", e.target.value)} />
                </div>
                <div className="k-contact__field k-contact__full">
                  <Label htmlFor="contact-message">Your message <span aria-hidden="true">*</span></Label>
                  <Textarea id="contact-message" name="message" required minLength={12} maxLength={2500} rows={6} placeholder="Tell us what you'd like to discuss…" value={values.message} onChange={e => update("message", e.target.value)} error={!!errors.message} aria-describedby={`contact-message-hint${errors.message ? " contact-message-error" : ""}`} />
                  <div id="contact-message-hint" className="k-contact__field-note"><span>At least 12 characters.</span><span>{values.message.length.toLocaleString("en")} / 2,500</span></div>
                  {errors.message && <p id="contact-message-error" className="k-contact__error" role="alert">{errors.message}</p>}
                </div>
              </div>
              <div className="k-contact__form-actions">
                <p className="k-contact__disclaimer">This page prepares an email draft. It does not send or save your message.</p>
                <GlassCtaButton ref={submitRef} type="submit" icon={<KretopiaIcon name="arrow-right" size={16} aria-hidden="true" />}>Review your message</GlassCtaButton>
              </div>
            </form>
          </div>

          <aside className="k-contact__aside" aria-labelledby="contact-topics-heading">
            <p className="landing-eyebrow">DIFFERENT CONVERSATIONS. ONE TEAM.</p>
            <h2 id="contact-topics-heading">The right place to start.</h2>
            <p className="k-contact__body">Choose what best describes your message.</p>
            <div className="k-contact__routes">
              {STARTING_POINTS.map(({ topic: value, title, description, icon: Icon }) => <button key={value} type="button" className="k-contact__route" onClick={() => chooseTopic(value)}>
                <Icon size={19} aria-hidden="true" />
                <span><strong>{title}</strong><span>{description}</span></span>
                <KretopiaIcon name="arrow-right" size={16} aria-hidden="true" />
              </button>)}
            </div>
            <p className="k-contact__body k-contact__aside-note">For press or media enquiries, choose <strong>Press &amp; media</strong> in the form.</p>
      <a className="k-contact__press-email"
         href="mailto:support@kretopia.com">
        support@kretopia.com
      </a>
          </aside>
        </div>
      </section>
      <EditorialFooter />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby="contact-preview-description" onCloseAutoFocus={event => { event.preventDefault(); submitRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Review your message.</DialogTitle>
            <DialogDescription id="contact-preview-description">Nothing has been sent. Copy your message or open it in your email application to send it.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="contact-preview" className="sr-only">Email draft</Label>
          <Textarea ref={previewRef} id="contact-preview" readOnly rows={10} value={draft.text} />
          <div className="k-contact__preview-actions">
            <OutlineCtaButton onClick={copyMessage} icon={<KretopiaIcon name="copy" size={16} aria-hidden="true" />}>Copy message</OutlineCtaButton>
            <GlassCtaButton onClick={() => window.location.assign(draft.href)}>Open email draft</GlassCtaButton>
          </div>
          <p role="status" className="text-sm text-muted-foreground">{copyStatus}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
