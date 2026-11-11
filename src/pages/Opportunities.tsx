import { useAccountTone } from "@/hooks/useAccountTone";
import ManageOpportunities from "@/pages/ManageOpportunities";
import { useSearchParams } from "react-router-dom";
import { RedirectKeepingSearch } from "@/components/RedirectKeepingSearch";
import { scoutFeedTarget } from "@/lib/opportunityRoutes";

/** Compatibility entry: preserve Company management and move discovery into Scout. */
const Opportunities = () => {
  const [params] = useSearchParams();
  const { isBusiness } = useAccountTone();
  if (isBusiness && params.get("view") !== "marketplace") return <ManageOpportunities company />;
  return <RedirectKeepingSearch to={scoutFeedTarget(params.toString())} />;
};

export default Opportunities;
