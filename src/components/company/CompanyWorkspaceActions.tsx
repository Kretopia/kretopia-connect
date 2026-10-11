import { Link } from "react-router-dom";
import { Briefcase, UserSearch, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompanyWorkspaceActions() {
  return (
    <nav aria-label="Company workspace" className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {[
        { label: "Post a Gig", path: "/post-opportunity", icon: Briefcase },
        { label: "Review applicants", path: "/opportunity-dashboard", icon: Users },
        { label: "Find talent", path: "/talent-finder", icon: UserSearch },
        { label: "Pay creators", path: "/thrivepay", icon: Wallet },
      ].map(({ label, path, icon: Icon }) => (
        <Button key={path} asChild variant="outline" size="sm">
          <Link to={path}><Icon aria-hidden className="h-4 w-4" />{label}</Link>
        </Button>
      ))}
    </nav>
  );
}