import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings as SettingsIcon } from "lucide-react";
import Settings from "@/pages/Settings";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

/**
 * Settings navbar entry — icon button next to Notifications, opening a side
 * panel instead of navigating to a full page. Same Sheet primitive and
 * right-side/animation/mobile behavior as NotificationCenter. The panel
 * renders the exact same <Settings /> page component in "embedded" mode
 * (header/back-button chrome hidden, all settings logic untouched) so
 * there's no second settings implementation to keep in sync.
 */
export const SettingsDrawer = ({ triggerClassName }: { triggerClassName?: string } = {}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-8 w-8 sm:h-10 sm:w-10", triggerClassName)} aria-label="Settings">
          <SettingsIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 text-left">
          <BrandLogo size="sm" showBeta />
          <SheetTitle className="font-serif text-2xl font-normal mt-1">Settings</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <Settings embedded />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsDrawer;
