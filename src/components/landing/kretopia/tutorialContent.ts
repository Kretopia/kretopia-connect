/**
 * Tutorial step copy for every landing-page feature chapter. Each entry
 * describes real product behavior — nothing here claims functionality the
 * app doesn't have, and no step describes Kreto or any AI surface acting
 * autonomously; every AI-touched step is framed as suggest-then-confirm.
 */
import {
  Search, UserCheck, FileEdit, Rocket,
  Fingerprint, ListChecks, Sparkles as SparklesIcon, Send,
  ShieldCheck, HandHeart, Stamp,
  Radar, Target, Bookmark, FolderKanban,
  Users, MessageCircle, HeartHandshake, Handshake,
  ClipboardList, Users2, Milestone, Banknote,
  DoorOpen, Video, UploadCloud, Share2,
  Lightbulb, ThumbsUp, CheckCircle2,
  Briefcase, UserPlus, LineChart, Wallet, CreditCard, PiggyBank,
} from "lucide-react";
import type { TutorialStep } from "./FeatureTutorial";

export const SEARCH_TUTORIAL: TutorialStep[] = [
  { icon: Search, title: "Search your name", body: "Type your name, stage name, or a project you've worked on into the search bar above." },
  { icon: Fingerprint, title: "Discover your record", body: "Kretopia surfaces any public work already associated with you — credits, projects, mentions." },
  { icon: UserCheck, title: "Claim or create a Passport", body: "Found your record? Claim it. Nothing yet? Start a fresh Creative Passport instead." },
  { icon: Rocket, title: "Continue to the next action", body: "From there you're in — confirm credits, explore Scout, or open Studio for your next project." },
];

export const PASSPORT_TUTORIAL: TutorialStep[] = [
  { icon: UserCheck, title: "Review your identity", body: "Check your name, role, avatar, and bio — the basics that appear on your public Passport." },
  { icon: ListChecks, title: "Confirm your credits", body: "Go through each imported or claimed credit and confirm it's actually yours before it counts." },
  { icon: FileEdit, title: "Review before it publishes", body: "Any drafted bio or summary stays fully editable — nothing publishes without your changes reviewed." },
  { icon: SparklesIcon, title: "Publish your Passport", body: "Once you're happy with it, publish — your Passport becomes your one shareable link." },
];

export const VERIFIED_CREDITS_TUTORIAL: TutorialStep[] = [
  { icon: ListChecks, title: "Add or confirm a credit", body: "Add a project you worked on, or confirm one Kretopia found — with a link or detail backing it up." },
  { icon: HandHeart, title: "Request a Co-Sign", body: "Ask a collaborator who was there to confirm it. Their co-sign moves the credit forward honestly." },
  { icon: Stamp, title: "Earn a Passport Stamp", body: "Once fully confirmed, the credit becomes a Passport Stamp — visible proof on your public record." },
];

export const SCOUT_TUTORIAL: TutorialStep[] = [
  { icon: Radar, title: "Discover an opportunity", body: "Scout reads real gigs, briefs, and casting calls from across the web and surfaces the ones that fit." },
  { icon: Target, title: "See why it matched", body: "Each match shows the reasoning — the skills, credits, or history that made it relevant to you." },
  { icon: Bookmark, title: "Save or dismiss", body: "Keep it for later, or clear it from your feed. Either way, Scout keeps refining what it shows you." },
  { icon: Send, title: "Apply with your Passport", body: "Kreto can draft a pitch from your real Passport and history — you edit it and decide if it goes." },
  { icon: FolderKanban, title: "Move into a project", body: "Once you're in, the opportunity becomes a real Studio project you can manage end to end." },
];

export const MATCH_TUTORIAL: TutorialStep[] = [
  { icon: Users, title: "Set what you're looking for", body: "Skill, city, vibe, or people you've already worked with — Match narrows to real fits, not cold lists." },
  { icon: MessageCircle, title: "See who's suggested", body: "Browse collaborators Match surfaces, each with the shared context that connects you." },
  { icon: HeartHandshake, title: "Start a real conversation", body: "No cold DMs — reach out with the shared project or connection already in view." },
  { icon: Handshake, title: "Turn it into work", body: "When it's a fit, bring them into a Studio project together." },
];

export const STUDIO_TUTORIAL: TutorialStep[] = [
  { icon: ClipboardList, title: "Create a project", body: "Start a Studio for the shoot, drop, release, or campaign you're working on." },
  { icon: Users2, title: "Add a brief and collaborators", body: "Bring in the brief, the files, and the people working on it with you." },
  { icon: Milestone, title: "Define milestones", body: "Break the project into milestones so progress and payment stay tied to real deliverables." },
  { icon: Banknote, title: "Deliver and get paid", body: "Mark milestones complete, send invoices, and get paid — all inside the same room." },
];

/** SoundStages hosts two distinct formats — kept clearly separate here,
 * never blended into one generic "audition or speed-network" step. */
export const SOUNDSTAGES_TUTORIAL: TutorialStep[] = [
  { icon: DoorOpen, title: "Choose your room type", body: "Speed Sessions are live, rotating conversations. Auditions are submission-first — you send work, the host reviews it." },
  { icon: Video, title: "Speed Session: rotate live", body: "Drop into a live room and meet a new person every few minutes. No submission needed — just show up." },
  { icon: UploadCloud, title: "Audition: submit, then get reviewed", body: "Submit a video, song, or portfolio first. The host reviews submissions and invites shortlisted candidates to a live round." },
  { icon: Share2, title: "Connect afterwards", body: "Whichever format you joined, the people you met stay reachable — follow up through their Passport." },
];

export const KRETO_TUTORIAL: TutorialStep[] = [
  { icon: Lightbulb, title: "Get context-aware guidance", body: "Kreto answers using your real Passport and history — not a generic script." },
  { icon: ThumbsUp, title: "Review the suggestion", body: "Drafts, plans, or shortlists Kreto proposes are always shown to you first, clearly labeled AI-assisted." },
  { icon: CheckCircle2, title: "Confirm the action", body: "Nothing becomes part of your record or gets sent until you confirm it." },
];

export const MESSAGES_TUTORIAL: TutorialStep[] = [
  { icon: DoorOpen, title: "Open your inbox", body: "See every conversation in one place, with unread messages clearly marked." },
  { icon: MessageCircle, title: "Choose a conversation", body: "Select a thread — the person's Passport context is right there alongside it." },
  { icon: Send, title: "Send a message", body: "Type and send — delivery and read state update in the thread." },
  { icon: Video, title: "Start a call safely", body: "When you're ready, start a call with one click — camera and mic access is requested only then." },
];

export const TALENT_FINDER_TUTORIAL: TutorialStep[] = [
  { icon: Briefcase, title: "Describe what you need", body: "Role, skills, budget, timeline, location — the more detail in your brief, the sharper the match." },
  { icon: SparklesIcon, title: "Kreto scores real creators", body: "Kreto ranks people from Kretopia's live creator network against your brief — not a static directory, run again any time for fresh results." },
  { icon: ListChecks, title: "See why each one matched", body: "Every result shows the actual reasons it ranked — the skills, experience, or history that made it relevant." },
  { icon: UserPlus, title: "Shortlist or message", body: "Shortlist the ones you like, or message them directly from the result — no cold outreach needed." },
];

/** For company/brand accounts specifically — mirrors STUDIO_TUTORIAL's shape
 *  but framed around hiring and managing creators rather than a creator's
 *  own project work. */
export const STUDIO_BRAND_TUTORIAL: TutorialStep[] = [
  { icon: Briefcase, title: "Post an opportunity", body: "Describe the role — paid or barter — and it goes live to creators across Kretopia." },
  { icon: UserPlus, title: "Review applicants or search directly", body: "See who applied, or use Smart Talent Finder to search the creator network yourself." },
  { icon: Milestone, title: "Hire and track the work", body: "Bring the creator into a Studio project — brief, files, and milestones all in one room." },
  { icon: LineChart, title: "See your hiring activity", body: "Every posting, hire, and response lands here — your Brand Passport strength updates as you go." },
];

/** For company/brand accounts specifically — KrePay's payments framed
 *  around paying the creators a brand hires, not "getting paid for
 *  creative work" (the creator-facing framing on the rest of the page
 *  this coexists with). */
export const KREPAY_BRAND_TUTORIAL: TutorialStep[] = [
  { icon: Wallet, title: "Fund your wallet", body: "Add funds once — pay any creator you hire from the same balance, no repeated card entry." },
  { icon: CreditCard, title: "Pay against milestones", body: "Release payment as work is delivered and approved, tied to the same milestones as the project." },
  { icon: PiggyBank, title: "Track spend and fees", body: "See exactly what you've paid, what's pending, and what Kretopia's fee actually costs — no surprises." },
];
