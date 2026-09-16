import { useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { VoiceFirstCreateModal } from "@/components/project/studio/VoiceFirstCreateModal";

/**
 * New Room's full-page form -- the "agrandir la fenêtre" destination.
 * VoiceFirstCreateModal is already a full-screen overlay with its own
 * complete chrome (top bar, HoloCard shell, celebration), so this page is
 * a thin host: it renders the exact same component with `open` always
 * true and no close affordance beyond "back", at a real, bookmarkable
 * URL. The in-progress draft carries over automatically -- New Room
 * already persists it to sessionStorage keyed by user id and rehydrates
 * on mount, regardless of whether it's reached via the modal or this route.
 */
const NewRoomPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO title="New Room — Kretopia" description="Tell Kreto what you're making and open a new Studio room." />
      <VoiceFirstCreateModal
        open
        onOpenChange={(open) => { if (!open) navigate(-1); }}
        onCreated={() => {}}
      />
    </>
  );
};

export default NewRoomPage;
