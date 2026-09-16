import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchCreators from "./tools/search-creators";
import getMyPassport from "./tools/get-my-passport";
import listMyStudios from "./tools/list-my-studios";
import listScoutedGigs from "./tools/list-scouted-gigs";
import listMyCredits from "./tools/list-my-credits";

// Build issuer from project ref (import.meta.env is inlined at build; falls back
// to a sentinel during the throwaway manifest-extract eval where no token verifies).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kretopia-mcp",
  title: "Kretopia — Creative OS",
  version: "0.1.0",
  instructions:
    "Kretopia is the operating system for creative careers. Use these tools to search the creative universe, read the signed-in user's Creative Passport and Stamps (credits), list their Studios (projects), and surface Scout opportunities. All tools act as the signed-in Kretopia user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchCreators, getMyPassport, listMyStudios, listScoutedGigs, listMyCredits],
});
