import { MapPin, Coffee, Briefcase, Store, Music, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const partnerCategories = [
  {
    icon: Coffee,
    name: "Cafes & Restaurants",
    discount: "10-20% off",
    locations: "15+ locations",
    color: "from-orange-500 to-amber-600",
  },
  {
    icon: Briefcase,
    name: "Co-working Spaces",
    discount: "25% off",
    locations: "8+ locations",
    color: "from-primary to-primary",
  },
  {
    icon: Store,
    name: "Creative Shops",
    discount: "15% off",
    locations: "12+ locations",
    color: "from-primary to-primary",
  },
  {
    icon: Music,
    name: "Studios & Rehearsal",
    discount: "20% off",
    locations: "6+ locations",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Camera,
    name: "Equipment Rental",
    discount: "15-30% off",
    locations: "5+ locations",
    color: "from-red-500 to-rose-600",
  },
];

export const PartnerBenefitsSection = () => {
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            Member Benefits
          </Badge>
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">
            Exclusive{" "}
            <span className="inline-block bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Partner Discounts
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Get instant access to 50+ partner locations across studios, cafes, co-working spaces, and more
          </p>
        </div>

        {/* Featured Benefits Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {partnerCategories.map((category, idx) => {
            const Icon = category.icon;
            return (
              <Card 
                key={idx}
                className="group hover:shadow-glow transition-all duration-300 border-border/50 hover:border-primary/30"
              >
                <CardContent className="p-6">
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{category.name}</h3>
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="font-semibold">
                      {category.discount}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {category.locations}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Show your membership and save
                  </p>
                </CardContent>
              </Card>
            );
          })}

          {/* CTA Card */}
          <Card className="group bg-gradient-to-br from-primary via-secondary to-accent text-primary-foreground border-0 hover:shadow-glow transition-all duration-300">
            <CardContent className="p-6 flex flex-col justify-center items-center text-center h-full">
              <MapPin className="h-12 w-12 mb-4 opacity-90" />
              <h3 className="font-bold text-xl mb-2">50+ Locations</h3>
              <p className="text-sm opacity-90 mb-4">
                And growing every week
              </p>
              <Link to="/membership">
                <Button 
                  variant="outline" 
                  className="border-white/30 bg-white/10 hover:bg-white/20 text-white"
                >
                  View All Partners
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Featured Partner Locations */}
        <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Featured Locations</h3>
              <p className="text-muted-foreground">Check in and earn Thrive Points at partner venues</p>
            </div>
            <Link to="/partner-directory">
              <Button variant="outline">
                View All
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "The Commons", type: "Co-working", location: "Bali, Indonesia", discount: "25% off" },
              { name: "Cafe Organic", type: "Cafe", location: "Canggu, Bali", discount: "15% off" },
              { name: "Studio 88", type: "Recording Studio", location: "Seminyak, Bali", discount: "20% off" },
            ].map((location, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3 p-4 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{location.name}</h4>
                  <p className="text-sm text-muted-foreground">{location.type}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{location.location}</span>
                    <Badge variant="secondary" className="text-xs">{location.discount}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Get even more partner benefits with Creator+ membership
          </p>
          <Link to="/membership">
            <Button size="lg" className="font-semibold">
              Upgrade to Creator+
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
