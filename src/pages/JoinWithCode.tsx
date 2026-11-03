import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { KretopiaSpinner } from "@/components/brand/KretopiaLoader";
import { GuestEntryChoice } from "@/components/auth/GuestEntryChoice";
import { useEntryChoice } from "@/hooks/useEntryChoice";

// Known partner codes (non-commission, org-level tracking)
const PARTNER_CODES = ["CREATIVETT", "ARTISTREGISTRY"];

/**
 * /join/:code route - stores the invite code, then asks signed-out visitors to sign in or continue as a guest.
 * Supports: personal invite codes, talent manager referral codes, and partner org codes
 *
 * The code is kept in this session's storage either way, so a guest who signs up later still carries it. A signed-in person has nothing
 * to choose and goes on to /auth, as before.
 */
const JoinWithCode = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const entry = useEntryChoice(`join:${(code ?? "").toUpperCase()}`);

  useEffect(() => {
    if (code) {
      const upperCode = code.toUpperCase();
      
      // Check if this is a partner organization code
      if (PARTNER_CODES.includes(upperCode)) {
        sessionStorage.setItem("partner_code", upperCode);
        console.log(`Partner code "${upperCode}" stored for signup`);
      } else {
        // Store as personal invite code
        sessionStorage.setItem("invite_code", upperCode);
        // Also store as potential manager referral code
        sessionStorage.setItem("manager_referral_code", upperCode);
        console.log(`Invite code "${upperCode}" stored for signup`);
      }
    }
  }, [code]);

  useEffect(() => {
    if (entry.user) navigate("/auth", { replace: true });
    else if (entry.isGuest) navigate("/", { replace: true });
  }, [entry.user, entry.isGuest, navigate]);

  if (entry.needsChoice) {
    return (
      <GuestEntryChoice
        title="You've been invited to Kretopia"
        signInTo="/"
        signInUrl="/auth"
        signInHint="Use your account, or create one."
        guestHint="Look around without an account."
        onContinueAsGuest={entry.continueAsGuest}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <KretopiaSpinner className="h-8 w-8" />
    </div>
  );
};

export default JoinWithCode;
