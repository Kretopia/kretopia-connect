import { Bot, Building2, CalendarDays, Database, DollarSign, Heart, Plus, Sparkles, Sun, Theater, UserPlus, Users, Video } from "lucide-react";

export function getMenuSections(isCompany: boolean, isManager: boolean) {
  return [
    { title: "Workspace", items: [
      { icon: Bot, label: "Kreto", path: "/kreto" },
      isCompany ? { icon: Plus, label: "Post a Gig", path: "/post-opportunity" } : { icon: DollarSign, label: "KrePay", path: "/thrivepay" },
      { icon: Building2, label: "Clients", path: "/clients" },
    ] },
    ...(isManager ? [{ title: "Management", items: [{ icon: Users, label: isCompany ? "Talent Manager" : "Manager Mode", path: "/talent-manager" }] }] : []),
    ...(isCompany ? [{ title: "Explore", items: [
      { icon: Sun, label: "Today", path: "/" },
      { icon: Heart, label: "Match", path: "/match" },
      { icon: Theater, label: "Stages", path: "/circle" },
    ] }] : []),
    { title: isCompany ? "Activity" : "Explore", items: [
      ...(!isCompany ? [{ icon: Theater, label: "Stages", path: "/circle" }] : []),
      { icon: CalendarDays, label: "Events", path: "/meetup" },
      { icon: Video, label: "Recordings", path: "/recordings" },
    ] },
    { title: "More", items: [
      { icon: Sparkles, label: "Spotlight", path: "/spotlight" },
      { icon: Database, label: "Credits", path: "/credits" },
      { icon: UserPlus, label: "Creative Circle", path: "/creative-circle" },
    ] },
  ];
}