import { useAuth } from "@/hooks/useAuth";
import { AccountingDashboard } from "@/components/project/AccountingDashboard";
import { FreeTierGate } from "@/components/FreeTierGate";
import { Navigate } from "react-router-dom";
import { SnapReceiptFAB } from "@/components/thrivepay/SnapReceiptFAB";

const Accounting = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl pb-24 md:pb-6">
      <FreeTierGate 
        feature="expenses"
        featureLabel="Creative Earnings" 
        description="Upgrade to Pro for unlimited expense tracking, invoicing, and earnings insights."
      >
        <AccountingDashboard />
      </FreeTierGate>
      <SnapReceiptFAB />
    </div>
  );
};

export default Accounting;
