import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Known partner codes (non-commission, org-level tracking)
const PARTNER_CODES = ["CREATIVETT", "ARTISTREGISTRY"];

/**
 * /join/:code route - stores invite code and redirects to auth
 * Supports: personal invite codes, talent manager referral codes, and partner org codes
 */
const JoinWithCode = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

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
    
    navigate("/auth", { replace: true });
  }, [code, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>
  );
};

export default JoinWithCode;
