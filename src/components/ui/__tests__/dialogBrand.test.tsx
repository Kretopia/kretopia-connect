import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../alert-dialog";
import { DialogBrandHeader } from "../dialogBrand";
import { Sheet, SheetContent, SheetTitle } from "../sheet";
import { Drawer, DrawerContent, DrawerTitle } from "../drawer";
import { DIALOG_BACKDROP, DIALOG_CLOSE, DIALOG_SCROLL, DIALOG_SURFACE, DIALOG_TITLE } from "../dialogBrand.tokens";
import { ModalSurfaceProvider } from "../ModalSurfaceProvider";
import { useModalSurfaceClasses } from "../modalSurface";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/components/brand/KretopiaQRCode", () => ({
  KretopiaQRCode: () => <div data-testid="branded-qr" />,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape" });

const classes = (value: string) => value.split(/\s+/);
const has = (el: Element, tokens: string) => classes(tokens).every((token) => el.classList.contains(token));
const hasAny = (el: Element, tokens: string) => classes(tokens).some((token) => el.classList.contains(token));

const Plain = ({ brand, className }: { brand?: boolean; className?: string }) => (
  <Dialog open>
    <DialogContent brand={brand} className={className}>
      <DialogHeader>
        <DialogTitle>Rename project</DialogTitle>
        <DialogDescription>Pick a new name.</DialogDescription>
      </DialogHeader>
      <button type="button">Save</button>
    </DialogContent>
  </Dialog>
);

describe("shared modal primitive", () => {
  beforeEach(() => mockUseAuth.mockReset());

  it("stays the plain primitive with no provider (a visitor, a public page)", () => {
    render(<Plain />);
    const dialog = screen.getByRole("dialog");
    expect(hasAny(dialog, DIALOG_SURFACE)).toBe(false);
    expect(dialog).toHaveClass("bg-background", "shadow-lg", "max-h-[90vh]");
    expect(screen.getByText("Rename project")).toHaveClass("text-lg", "leading-none");
  });

  it("wears the QR modal's surface, border, aura and title for a signed-in member", () => {
    render(
      <ModalSurfaceProvider branded>
        <Plain />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("dialog");
    expect(has(dialog, DIALOG_SURFACE)).toBe(true);
    expect(dialog).toHaveClass("border-energy/30", "bg-card", "shadow-glow");
    expect(dialog).not.toHaveClass("bg-background");
    const title = screen.getByText("Rename project");
    expect(has(title, DIALOG_TITLE)).toBe(true);
    // text-2xl brings its own line height: the primitive's leading-none is dropped, as in the QR modal
    expect(title).not.toHaveClass("text-lg");
    expect(title).not.toHaveClass("leading-none");
    expect(screen.getByText("Pick a new name.")).toHaveClass("text-sm", "text-muted-foreground");
  });

  it("scrolls inside itself, measured in dynamic viewport units so a phone's last row stays reachable", () => {
    render(
      <ModalSurfaceProvider branded>
        <Plain />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("dialog");
    expect(has(dialog, DIALOG_SCROLL)).toBe(true);
    expect(dialog).not.toHaveClass("max-h-[90vh]");
  });

  it("keeps the backdrop, the opening animation and the close control the primitive always had", () => {
    const { baseElement } = render(
      <ModalSurfaceProvider branded>
        <Plain />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("data-[state=open]:animate-in", "data-[state=open]:zoom-in-95");
    expect(baseElement.querySelector(".bg-black\\/80")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("lets a modal keep its own width, padding and height: className is merged last", () => {
    render(
      <ModalSurfaceProvider branded>
        <Plain className="max-w-sm p-0 max-h-[85vh] bg-muted" />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-sm", "p-0", "max-h-[85vh]", "bg-muted");
    expect(dialog).not.toHaveClass("max-w-lg");
    expect(dialog).not.toHaveClass("bg-card");
    // the rest of the brand is still there
    expect(dialog).toHaveClass("border-energy/30", "shadow-glow");
  });

  it("brand={true} forces the surface and brand={false} keeps it plain, whatever the provider says", () => {
    const { unmount } = render(<Plain brand />);
    expect(has(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(true);
    unmount();

    render(
      <ModalSurfaceProvider branded>
        <Plain brand={false} />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("dialog");
    expect(hasAny(dialog, DIALOG_SURFACE)).toBe(false);
    // the title follows the modal it is in, not the app
    expect(screen.getByText("Rename project")).toHaveClass("text-lg");
  });

  it("Escape closes the modal and puts focus back on what opened it", async () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <ModalSurfaceProvider branded>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button">Open settings</button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Settings</DialogTitle>
              <button type="button">First control</button>
            </DialogContent>
          </Dialog>
        </ModalSurfaceProvider>
      );
    };
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open settings" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("shadow-glow");
    // focus moves inside the modal
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    escape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("the close control dismisses it", () => {
    const onOpenChange = vi.fn();
    render(
      <ModalSurfaceProvider branded>
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Settings</DialogTitle>
          </DialogContent>
        </Dialog>
      </ModalSurfaceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a modal opened from inside a branded modal is branded too, and Escape closes only the top one", async () => {
    render(
      <ModalSurfaceProvider branded>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Outer</DialogTitle>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button">Open inner</button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Inner</DialogTitle>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      </ModalSurfaceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));
    // Radix hides the outer modal from assistive tech while the inner one is open, hence `hidden: true`
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(2));
    for (const dialog of screen.getAllByRole("dialog", { hidden: true })) expect(dialog).toHaveClass("border-energy/30", "shadow-glow");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveTextContent("Inner");

    escape();
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(1));
    expect(screen.getByRole("dialog")).toHaveTextContent("Outer");
    expect(screen.getByText("Outer")).toBeInTheDocument();
    expect(screen.queryByText("Inner")).toBeNull();
  });
});

describe("shared alert dialog", () => {
  const Confirm = ({ onConfirm, onOpenChange, brand }: { onConfirm: () => void; onOpenChange?: (open: boolean) => void; brand?: boolean }) => (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent brand={brand}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  it("is the plain alert with no provider", () => {
    render(<Confirm onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("alertdialog");
    expect(hasAny(dialog, DIALOG_SURFACE)).toBe(false);
    expect(dialog).toHaveClass("bg-background", "w-full");
    expect(screen.getByText("Delete this project?")).toHaveClass("text-lg");
  });

  it("wears the same surface for a signed-in member, insets from the screen edge and scrolls inside itself", () => {
    render(
      <ModalSurfaceProvider branded>
        <Confirm onConfirm={vi.fn()} />
      </ModalSurfaceProvider>,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(has(dialog, DIALOG_SURFACE)).toBe(true);
    expect(has(dialog, DIALOG_SCROLL)).toBe(true);
    expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
    expect(dialog).not.toHaveClass("w-full");
    expect(has(screen.getByText("Delete this project?"), DIALOG_TITLE)).toBe(true);
  });

  it("keeps the destructive safeguards: the action only runs when pressed, Cancel and Escape dismiss, an outside click does not", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ModalSurfaceProvider branded>
        <Confirm onConfirm={onConfirm} onOpenChange={onOpenChange} />
      </ModalSurfaceProvider>,
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive");

    // clicking the backdrop must not dismiss a destructive confirmation
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();

    escape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("focus starts on the cancel button, the safe choice, and returns to the trigger", async () => {
    render(
      <ModalSurfaceProvider branded>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button">Remove</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Remove?</AlertDialogTitle>
            <AlertDialogDescription>Really.</AlertDialogDescription>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction>Remove</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      </ModalSurfaceProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Remove" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("alertdialog");
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus());
    escape();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("the QR modal is the reference, and reads the same tokens", () => {
  it("DialogBrandHeader draws the K mark, the Kretopia name, the title and one line, in the brand even with no provider", () => {
    render(
      <Dialog open>
        <DialogContent brand className="p-0">
          <DialogBrandHeader title="Receipt" description="Paid today" />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Kretopia")).toBeInTheDocument();
    expect(has(screen.getByRole("heading", { name: "Receipt" }), DIALOG_TITLE)).toBe(true);
    expect(screen.getByText("Paid today")).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector("img")).not.toBeNull();
  });

  it("the Passport QR modal wears the shared surface for a visitor too, and keeps its own width", async () => {
    const { ProfileQRDialog } = await import("@/components/profile/ProfileQRDialog");
    render(<ProfileQRDialog open onOpenChange={vi.fn()} userId="12345abc-0000-0000-0000-000000000000" userName="Noé Plantier" />);
    const dialog = screen.getByRole("dialog");
    expect(has(dialog, DIALOG_SURFACE)).toBe(true);
    expect(dialog).toHaveClass("max-w-sm", "p-0");
    expect(has(screen.getByRole("heading", { name: "Passport QR" }), DIALOG_TITLE)).toBe(true);
    expect(screen.getByText(/KRT-12345/)).toBeInTheDocument();
  });
});

describe("AuthenticatedModalSurface", () => {
  beforeEach(() => mockUseAuth.mockReset());

  it("brands the modals of a signed-in member and leaves a visitor's plain", async () => {
    const { AuthenticatedModalSurface } = await import("@/components/auth/AuthenticatedModalSurface");

    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const signedIn = render(
      <AuthenticatedModalSurface>
        <Plain />
      </AuthenticatedModalSurface>,
    );
    expect(has(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(true);
    signedIn.unmount();

    mockUseAuth.mockReturnValue({ user: null });
    render(
      <AuthenticatedModalSurface>
        <Plain />
      </AuthenticatedModalSurface>,
    );
    expect(hasAny(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(false);
  });
});

describe("shared sheet", () => {
  const Panel = ({ brand, quick, className }: { brand?: boolean; quick?: boolean; className?: string }) => (
    <Sheet open>
      <SheetContent side={quick ? "top" : "right"} quick={quick} brand={brand} className={className}>
        <SheetTitle>Filters</SheetTitle>
        <p>panel</p>
      </SheetContent>
    </Sheet>
  );

  it("stays the plain panel with no provider (a visitor)", () => {
    render(<Panel />);
    const panel = screen.getByRole("dialog");
    expect(hasAny(panel, DIALOG_SURFACE)).toBe(false);
    expect(panel).toHaveClass("bg-background", "shadow-lg");
  });

  it("wears the QR modal's surface, border and aura for a signed-in member, and keeps its side, width and slide", () => {
    render(
      <ModalSurfaceProvider branded>
        <Panel />
      </ModalSurfaceProvider>,
    );
    const panel = screen.getByRole("dialog");
    expect(has(panel, DIALOG_SURFACE)).toBe(true);
    expect(panel).not.toHaveClass("bg-background");
    expect(panel).toHaveClass("right-0", "border-l", "sm:max-w-sm", "data-[state=open]:slide-in-from-right");
  });

  it("lets a panel keep its own width: className is merged last", () => {
    render(
      <ModalSurfaceProvider branded>
        <Panel className="w-full sm:max-w-lg" />
      </ModalSurfaceProvider>,
    );
    expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-lg", "shadow-glow");
  });

  it("never dresses the quick search sheet, which brings its own surface, and brand={false} keeps one plain", () => {
    const { unmount } = render(
      <ModalSurfaceProvider branded>
        <Panel quick />
      </ModalSurfaceProvider>,
    );
    expect(hasAny(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(false);
    unmount();
    render(
      <ModalSurfaceProvider branded>
        <Panel brand={false} />
      </ModalSurfaceProvider>,
    );
    expect(hasAny(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(false);
  });

  it("a dialog opened from inside a branded panel is branded too, and Escape closes only the dialog", async () => {
    render(
      <ModalSurfaceProvider branded>
        <Sheet open>
          <SheetContent>
            <SheetTitle>Panel</SheetTitle>
            <Dialog defaultOpen>
              <DialogContent>
                <DialogTitle>Inner</DialogTitle>
              </DialogContent>
            </Dialog>
          </SheetContent>
        </Sheet>
      </ModalSurfaceProvider>,
    );
    const inner = screen.getByText("Inner").closest('[role="dialog"]') as HTMLElement;
    expect(has(inner, DIALOG_SURFACE)).toBe(true);
    escape();
    await waitFor(() => expect(screen.queryByText("Inner")).toBeNull());
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });
});

describe("the sheet's title, the drawer and the backdrop", () => {
  const Titled = ({ brand, quick, titleClass }: { brand?: boolean; quick?: boolean; titleClass?: string }) => (
    <Sheet open>
      <SheetContent side={quick ? "top" : "right"} quick={quick} brand={brand}>
        <SheetTitle className={titleClass}>Filters</SheetTitle>
      </SheetContent>
    </Sheet>
  );
  const branded = (ui: React.ReactElement) => render(<ModalSurfaceProvider branded>{ui}</ModalSurfaceProvider>);

  it("a branded sheet's title is the QR modal's: its size, weight and tracking", () => {
    branded(<Titled />);
    const title = screen.getByText("Filters");
    expect(has(title, DIALOG_TITLE)).toBe(true);
    expect(title).not.toHaveClass("text-lg");
  });

  it("a visitor's sheet, a quick sheet and one with brand={false} keep the sheet's own title", () => {
    const { unmount } = render(<Titled />);
    expect(screen.getByText("Filters")).toHaveClass("text-lg");
    unmount();
    const quick = branded(<Titled quick />);
    expect(screen.getByText("Filters")).toHaveClass("text-lg");
    expect(screen.getByText("Filters")).not.toHaveClass("text-2xl");
    quick.unmount();
    branded(<Titled brand={false} />);
    expect(screen.getByText("Filters")).toHaveClass("text-lg");
  });

  it("a title that sets its own size keeps it", () => {
    branded(<Titled titleClass="text-base" />);
    const title = screen.getByText("Filters");
    expect(title).toHaveClass("text-base");
    expect(title).not.toHaveClass("text-2xl");
  });

  it("a dialog opened from a quick sheet is branded, though the sheet's own title is not", () => {
    branded(
      <Sheet open>
        <SheetContent side="top" quick>
          <SheetTitle>Quick</SheetTitle>
          <Dialog defaultOpen>
            <DialogContent>
              <DialogTitle>Inner</DialogTitle>
            </DialogContent>
          </Dialog>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Quick")).not.toHaveClass("text-2xl");
    expect(has(screen.getByText("Inner"), DIALOG_TITLE)).toBe(true);
  });

  it("the drawer wears the surface and the title for a member, and is the plain drawer for a visitor", () => {
    const visitor = render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Pick one</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    expect(hasAny(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(false);
    expect(screen.getByText("Pick one")).toHaveClass("text-lg");
    visitor.unmount();
    branded(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Pick one</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    expect(has(screen.getByRole("dialog"), DIALOG_SURFACE)).toBe(true);
    expect(has(screen.getByText("Pick one"), DIALOG_TITLE)).toBe(true);
  });

  it("the dialog, the alert dialog, the sheet and the drawer draw the one backdrop token", () => {
    const overlayOf = () => document.querySelector<HTMLElement>('div.fixed.inset-0[data-state="open"]');
    const backdrop = DIALOG_BACKDROP;
    const dialog = render(<Plain />);
    expect(overlayOf()).toHaveClass(backdrop);
    dialog.unmount();
    const alert = render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete?</AlertDialogTitle><AlertDialogDescription>Sure.</AlertDialogDescription></AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(overlayOf()).toHaveClass(backdrop);
    alert.unmount();
    const sheet = render(<Titled />);
    expect(overlayOf()).toHaveClass(backdrop);
    sheet.unmount();
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Pick one</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    );
    expect(document.querySelector('[data-vaul-overlay]')).toHaveClass(backdrop);
  });

  it("the dialog's close control looks the way the shared token says, so an overlay that is not a dialog can match it", () => {
    render(<Plain />);
    const close = screen.getByRole("button", { name: "Close" });
    for (const token of classes(DIALOG_CLOSE)) expect(close, token).toHaveClass(token);
  });
});

describe("useModalSurfaceClasses: for a modal that is not a Radix dialog", () => {
  const Probe = ({ plain }: { plain?: { backdrop: string; panel: string; title?: string } }) => {
    const modal = useModalSurfaceClasses(plain ?? { backdrop: "bg-background/70", panel: "border-border/60 shadow-2xl", title: "text-sm font-semibold" });
    return <p data-testid="probe" data-branded={String(modal.branded)} data-backdrop={modal.backdrop} data-panel={modal.panel} data-title={modal.title} />;
  };

  it("gives a member the QR modal's backdrop, surface and title", () => {
    render(<ModalSurfaceProvider branded><Probe /></ModalSurfaceProvider>);
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-branded", "true");
    expect(probe).toHaveAttribute("data-backdrop", DIALOG_BACKDROP);
    expect(probe).toHaveAttribute("data-panel", DIALOG_SURFACE);
    expect(probe).toHaveAttribute("data-title", DIALOG_TITLE);
  });

  it("gives a visitor exactly what the modal always drew", () => {
    render(<Probe />);
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-branded", "false");
    expect(probe).toHaveAttribute("data-backdrop", "bg-background/70");
    expect(probe).toHaveAttribute("data-panel", "border-border/60 shadow-2xl");
    expect(probe).toHaveAttribute("data-title", "text-sm font-semibold");
  });

  it("leaves the title empty when a plain modal has none to give", () => {
    render(<Probe plain={{ backdrop: "bg-background/80", panel: "bg-background" }} />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-title", "");
  });
});
