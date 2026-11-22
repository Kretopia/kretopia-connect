import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The intro video upload says what is happening and never claims success early: the storage upload AND the Passport row
 * update must both succeed before "Saved" appears; a refused or failed step saves nothing and offers a retry with the
 * same file; a second pick during an upload is ignored; a file over the limit is refused before anything is sent.
 */
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const me = { id: "user-1" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me }) }));
vi.mock("@/lib/analytics", () => ({ analytics: { introVideoUpload: vi.fn() } }));

const state = vi.hoisted(() => ({
  upload: null as unknown as (path: string, file: File) => Promise<{ error: unknown }>,
  update: null as unknown as (row: Record<string, unknown>) => Promise<{ error: unknown }>,
  uploads: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string, file: File) => { state.uploads.push(path); return state.upload(path, file); },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
    from: () => ({ update: (row: Record<string, unknown>) => ({ eq: () => { state.updates.push(row); return state.update(row); } }) }),
  },
}));

import { VideoIntroSection } from "../VideoIntroSection";
import { checkIntroVideoFile, INTRO_VIDEO_MAX_BYTES, introUploadError } from "@/lib/passport/introVideoUpload";

const video = (name = "intro.mp4", size = 46 * 1024 * 1024, type = "video/mp4") => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};
const pick = (container: HTMLElement, file: File) => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

beforeEach(() => {
  toast.mockReset();
  state.uploads = [];
  state.updates = [];
  state.upload = async () => ({ error: null });
  state.update = async () => ({ error: null });
});

describe("intro video upload: honest status, no early success", () => {
  it("shows the file and size while uploading, then 'Saved' only after the Passport row points at the new file", async () => {
    let finish!: () => void;
    state.upload = () => new Promise((r) => { finish = () => r({ error: null }); });
    const onRefresh = vi.fn();
    const { container } = render(<VideoIntroSection videoUrl={null} isOwnProfile onRefresh={onRefresh} />);
    pick(container, video());
    expect(await screen.findByText(/Uploading intro\.mp4 \(46 MB\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Saved\./)).not.toBeInTheDocument();
    finish();
    expect(await screen.findByText("Saved. Your video intro now shows on your Passport.")).toBeInTheDocument();
    expect(state.uploads).toEqual(["user-1/video-intro.mp4"]);
    expect(String(state.updates[0].video_intro_url)).toMatch(/^https:\/\/cdn\.test\/user-1\/video-intro\.mp4\?v=\d+$/);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("a storage refusal saves nothing, says so, and retries with the same file", async () => {
    state.upload = async () => ({ error: { message: "The object exceeded the maximum allowed size", statusCode: "413" } });
    const { container } = render(<VideoIntroSection videoUrl={null} isOwnProfile onRefresh={vi.fn()} />);
    pick(container, video());
    expect(await screen.findByText(/refused the file as too large\. Nothing was changed on your Passport\./)).toBeInTheDocument();
    expect(state.updates).toHaveLength(0);
    state.upload = async () => ({ error: null });
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText(/^Saved\./)).toBeInTheDocument();
    expect(state.uploads).toHaveLength(2);
  });

  it("an upload whose Passport save fails is reported as not saved, never as added", async () => {
    state.update = async () => ({ error: { message: "permission denied" } });
    const { container } = render(<VideoIntroSection videoUrl={null} isOwnProfile onRefresh={vi.fn()} />);
    pick(container, video());
    expect(await screen.findByText(/uploaded, but it couldn't be saved to your Passport/)).toBeInTheDocument();
    expect(screen.queryByText(/^Saved\./)).not.toBeInTheDocument();
  });

  it("a second pick while uploading is ignored (one upload, one save)", async () => {
    let finish!: () => void;
    state.upload = () => new Promise((r) => { finish = () => r({ error: null }); });
    const { container } = render(<VideoIntroSection videoUrl={null} isOwnProfile onRefresh={vi.fn()} />);
    pick(container, video());
    pick(container, video("other.mp4"));
    finish();
    await screen.findByText(/^Saved\./);
    expect(state.uploads).toEqual(["user-1/video-intro.mp4"]);
    expect(state.updates).toHaveLength(1);
  });

  it("a file over the limit or not a video is refused before anything is sent", async () => {
    const { container } = render(<VideoIntroSection videoUrl={null} isOwnProfile onRefresh={vi.fn()} />);
    pick(container, video("big.mp4", INTRO_VIDEO_MAX_BYTES + 1));
    expect(await screen.findByText(/limit is 50 MB/)).toBeInTheDocument();
    pick(container, video("notes.pdf", 1000, "application/pdf"));
    await waitFor(() => expect(screen.getByText(/isn't a video/)).toBeInTheDocument());
    expect(state.uploads).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });
});

describe("intro video rules", () => {
  it("sanitises the extension used in the storage path", () => {
    expect(checkIntroVideoFile({ name: "Clip.MOV", size: 10, type: "video/quicktime" })).toEqual({ ok: true, ext: "mov" });
    expect(checkIntroVideoFile({ name: "evil.mp4/../x", size: 10, type: "video/mp4" })).toEqual({ ok: true, ext: "mp4" });
    expect(checkIntroVideoFile({ name: "noext", size: 10, type: "video/webm" })).toEqual({ ok: true, ext: "webm" });
    expect(checkIntroVideoFile({ name: "empty.mp4", size: 0, type: "video/mp4" }).ok).toBe(false);
  });

  it("maps storage and network failures to plain words", () => {
    expect(introUploadError(new TypeError("Load failed"))).toMatch(/connection dropped/);
    expect(introUploadError({ message: "invalid_mime_type" })).toMatch(/format isn't accepted/);
    expect(introUploadError({ message: "new row violates row-level security policy" })).toMatch(/signed out or not allowed/);
    expect(introUploadError({})).toBe("The upload didn't finish.");
  });
});
