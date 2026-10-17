import type { TutorialStep } from "@/components/landing/kretopia/FeatureTutorial";
import { BookOpen, Mic, Fingerprint, LayoutGrid, Users, Briefcase, Mail } from "lucide-react";

export const spotlightTutorial: TutorialStep[] = [
  { title: "Read the magazine", body: "Explore features and interviews with the people behind the work.", icon: BookOpen },
  { title: "Listen to the podcast", body: "Switch to Podcast for conversations about creative work and process.", icon: Mic },
  { title: "Share your story", body: "Use Publish your story to open the existing submission flow.", icon: Users },
];

export const aboutTutorial: TutorialStep[] = [
  { title: "The creative record", body: "A Creative Passport brings credits, collaborators and co-signs together.", icon: Fingerprint },
  { title: "From work to opportunity", body: "Explore how Search, Passport, Scout and Studio connect across Kretopia.", icon: LayoutGrid },
  { title: "Meet the founders", body: "Open The team to meet the people building Kretopia.", icon: Users },
];

export const hireTalentTutorial: TutorialStep[] = [
  { title: "Write your brief", body: "Enter your company, role and description. Start with Kreto if you want help drafting.", icon: Briefcase },
  { title: "Add the details", body: "Set the work type, location and compensation, then add skills or a cover image if needed.", icon: Users },
  { title: "Publish your opportunity", body: "Visitors confirm the email link before publication. Signed-in users use the existing posting flow.", icon: Mail },
];