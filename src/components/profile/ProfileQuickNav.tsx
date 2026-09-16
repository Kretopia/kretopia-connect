import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  User,
  Briefcase,
  Star,
  Award,
  Newspaper,
  BarChart3,
  Mail,
  Download,
  ChevronUp,
} from "lucide-react";

interface Section {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sections: Section[] = [
  { id: "overview", label: "Overview", icon: <User className="h-4 w-4" /> },
  { id: "portfolio", label: "Portfolio", icon: <Briefcase className="h-4 w-4" /> },
  { id: "experience", label: "Experience", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "reviews-stats", label: "Reviews", icon: <Star className="h-4 w-4" /> },
  { id: "press-awards", label: "Press & Awards", icon: <Award className="h-4 w-4" /> },
];

export function ProfileQuickNav() {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const handleScroll = () => {
      // Determine which section is in view
      const sectionElements = sections.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i];
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="hidden md:block fixed right-4 lg:right-6 top-1/2 -translate-y-1/2 z-[100]">
      <div className="bg-card border-2 border-primary/20 rounded-xl shadow-2xl p-2 space-y-1 min-w-[160px] lg:min-w-[180px]">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-left text-sm font-medium",
              activeSection === section.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "hover:bg-accent text-foreground"
            )}
          >
            <span className="flex-shrink-0">{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
        
        <div className="pt-1 mt-1 border-t border-border">
          <button
            onClick={scrollToTop}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-left text-sm font-medium hover:bg-accent text-foreground"
          >
            <ChevronUp className="h-4 w-4 flex-shrink-0" />
            <span>Back to Top</span>
          </button>
        </div>
      </div>
    </div>
  );
}
