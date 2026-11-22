import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { Button } from "@/components/ui/button";
import { PRIVACY } from "@/content/legal/privacy";
import { openCookieSettings } from "@/lib/cookieConsent";

const Privacy = () => (
  <LegalDocumentPage
    doc={PRIVACY}
    scene="passport"
    after={
      <div className="flex justify-center">
        <Button type="button" variant="outline" size="sm" onClick={openCookieSettings}>Cookie settings</Button>
      </div>
    }
  />
);

export default Privacy;
