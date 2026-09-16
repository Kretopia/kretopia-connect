import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Instagram } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useTranslation } from "react-i18next";


export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <BrandLogo size="md" />
            <p className="text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">{t("footer.product")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/passport" className="text-muted-foreground hover:text-foreground transition-colors">
                  Passport Directory
                </Link>
              </li>
              <li>
                <Link to="/subscription" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/partner-directory" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.partners")}
                </Link>
              </li>
              <li>
                <Link to="/partner-submit" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.becomePartner")}
                </Link>
              </li>
            </ul>

          </div>

          {/* Company */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">{t("footer.company")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.about")}
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:info@kretopia.com" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("footer.contactUs")}
                </a>
              </li>
              <li>
                <a 
                  href="mailto:support@kretopia.com" 
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("footer.support")}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">{t("footer.legal")}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/community-guidelines" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t("footer.communityGuidelines")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {currentYear} Kretopia by Thrive Collective. {t("footer.allRightsReserved")}</p>
          <div className="flex items-center gap-3">
            
            <a 
              href="https://instagram.com/kretopia" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Instagram className="h-4 w-4" />
              {t("footer.instagram")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
