import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
  cta: string;
  ctaLink: string;
}

export const PricingCard = ({
  name,
  price,
  period,
  features,
  popular,
  cta,
  ctaLink,
}: PricingCardProps) => {
  return (
    <div className={`relative rounded-2xl border bg-card p-6 shadow-card ${popular ? 'border-primary scale-105' : 'border-border'}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Most Popular
          </span>
        </div>
      )}
      <div className="mb-6">
        <h3 className="mb-2 text-2xl font-bold">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">{price}</span>
          <span className="text-muted-foreground">{period}</span>
        </div>
      </div>
      <ul className="mb-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link to={ctaLink}>
        <Button className="w-full" variant={popular ? "default" : "outline"}>
          {cta}
        </Button>
      </Link>
    </div>
  );
};
