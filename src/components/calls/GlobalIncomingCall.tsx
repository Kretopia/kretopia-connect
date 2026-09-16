import { useIncomingCallListener } from "@/hooks/useIncomingCall";
import { IncomingCallModal } from "./IncomingCallModal";

/**
 * Mounts a per-user Realtime listener that pops the IncomingCallModal
 * whenever someone rings this user. Mount once near the App root.
 */
export const GlobalIncomingCall = () => {
  const { incoming, dismiss } = useIncomingCallListener();
  return <IncomingCallModal call={incoming} onClose={dismiss} />;
};
