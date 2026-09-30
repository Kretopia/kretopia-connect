import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileQRDialog } from "../ProfileQRDialog";

const qr = vi.fn();
vi.mock("@/components/brand/KretopiaQRCode", () => ({
  KretopiaQRCode: (props: { data: string; onReady: (blob: Blob) => void }) => {
    qr(props.data);
    return <div data-testid="branded-qr"><button onClick={() => props.onReady(new Blob(["png"], { type: "image/png" }))}>ready</button></div>;
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("Passport QR", () => {
  it("opens the public passport URL in a Kretopia branded code with real actions", () => {
    const userId = "12345abc-0000-0000-0000-000000000000";
    render(<ProfileQRDialog open onOpenChange={vi.fn()} userId={userId} userName="Noé Plantier" />);
    expect(screen.getByText("Passport QR")).toBeInTheDocument();
    expect(screen.getByText(/KRT-12345/)).toBeInTheDocument();
    expect(qr).toHaveBeenCalledWith(`https://www.kretopia.com/profile/${userId}`);
    expect(screen.getByTestId("branded-qr")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy passport link" })).toBeEnabled();
    const download = screen.getByRole("button", { name: "Download passport QR as PNG" });
    expect(download).toBeDisabled();
    fireEvent.click(screen.getByText("ready"));
    expect(download).toBeEnabled();
  });
});