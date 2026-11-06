import { useParams } from "react-router-dom";
import { PublicPassportView } from "@/components/passport/PublicPassportView";

/** The public Passport page (/profile/:userId, /epk/:userId). The document itself is shared with the owner's own Passport page. */
const CreatorEPK = () => {
  const { userId } = useParams<{ userId: string }>();
  return <PublicPassportView userId={userId} />;
};

export default CreatorEPK;
