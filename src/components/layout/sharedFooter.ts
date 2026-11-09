import { createContext, useContext } from "react";

/**
 * Whether the app's shared footer (the Landing page's, see AppFooter) is drawn under the page being rendered. A page's own brand footer
 * (the lockup at the foot of a Wrapped panel, the small "kretopia" line under a public Passport) reads this and steps aside, so a page
 * never ends in two footers. Without a provider (a test, a page rendered on its own) it is false and those footers stay as they were.
 */
const SharedFooterContext = createContext(false);

export const SharedFooterProvider = SharedFooterContext.Provider;
export const useSharedFooter = () => useContext(SharedFooterContext);
