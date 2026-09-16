import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Sparkles, MessageSquarePlus, Clock, DollarSign, Download,
  Package, Pencil, Trash2, MoreVertical, Eye, Share2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateServiceDialog } from "./CreateServiceDialog";
import { CustomProjectRequestDialog } from "./CustomProjectRequestDialog";
import { SUPPORTED_CURRENCIES } from "@/hooks/useCurrencyConversion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ServiceTier {
  id: string;
  tier_name: string;
  price: number;
  price_max: number | null;
  currency: string;
  deliverables: string[];
  delivery_days: number | null;
  tier_order: number;
}

interface CreatorService {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  delivery_time: string | null;
  service_format: string | null;
  cover_image_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  tiers: ServiceTier[];
}

interface DigitalProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  listing_type: string;
  preview_urls: string[] | null;
  download_count: number | null;
  average_rating: number | null;
  review_count: number | null;
  tags: string[] | null;
}

interface WorkWithMeSectionProps {
  userId: string;
  isOwner: boolean;
  creatorName?: string;
}

export const WorkWithMeSection = ({ userId, isOwner, creatorName }: WorkWithMeSectionProps) => {
  const [services, setServices] = useState<CreatorService[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [showProjectRequest, setShowProjectRequest] = useState(false);
  const [editingService, setEditingService] = useState<CreatorService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'service' | 'product'; id: string } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, [userId]);

  const fetchData = async () => {
    try {
      const [servicesRes, productsRes] = await Promise.all([
        supabase.from('creator_services').select('*').eq('user_id', userId).eq('is_active', true).order('display_order'),
        supabase.from('digital_products').select('*').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }),
      ]);
      if (servicesRes.error) throw servicesRes.error;
      if (productsRes.error) throw productsRes.error;

      const serviceIds = (servicesRes.data || []).map((s: any) => s.id);
      let tiers: any[] = [];
      if (serviceIds.length > 0) {
        const { data: tiersData } = await supabase.from('service_tiers').select('*').in('service_id', serviceIds).order('tier_order');
        tiers = tiersData || [];
      }

      setServices((servicesRes.data || []).map((s: any) => ({
        ...s,
        tiers: tiers.filter((t: any) => t.service_id === s.id),
      })));
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching work-with-me data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.type === 'service' ? 'creator_services' : 'digital_products';
    await supabase.from(table).update({ is_active: false } as any).eq('id', deleteTarget.id);
    toast({ title: `${deleteTarget.type === 'service' ? 'Service' : 'Product'} removed` });
    setDeleteTarget(null);
    fetchData();
  };

  const handleEditService = (service: CreatorService) => {
    setEditingService(service);
    setShowAddService(true);
  };

  const hasContent = services.length > 0 || products.length > 0;

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>;
  if (!isOwner && !hasContent) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {isOwner ? "Your Offerings" : `Work With ${creatorName?.split(' ')[0] || 'Me'}`}
        </h2>
        {isOwner && (
          <Button size="sm" onClick={() => { setEditingService(null); setShowAddService(true); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Service
          </Button>
        )}
      </div>

      {!hasContent && isOwner && (
        <EmptyState
          icon={Sparkles}
          title="Start earning from your profile"
          description="Add services, packages, or digital products. Share your profile link to convert visitors into clients."
          action={{ label: "Add Your First Service", onClick: () => { setEditingService(null); setShowAddService(true); } }}
        />
      )}

      {/* Services — WhatsApp Business style cards */}
      {services.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</h3>
          <div className="grid gap-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isOwner={isOwner}
                onEdit={() => handleEditService(service)}
                onDelete={() => setDeleteTarget({ type: 'service', id: service.id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Digital Products */}
      {products.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Products</h3>
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-all group relative"
                onClick={() => navigate(`/market/${product.id}`)}
              >
                {isOwner && (
                  <div className="absolute top-1.5 right-1.5 z-10" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-7 w-7 p-0 rounded-full shadow-sm">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/market/${product.id}`)}>
                          <Eye className="h-3.5 w-3.5 mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'product', id: product.id })}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                {product.preview_urls?.[0] && (
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img src={product.preview_urls[0]} alt={product.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <div className="p-2.5">
                  <h4 className="font-semibold text-xs line-clamp-2">{product.title}</h4>
                  <span className="font-bold text-primary text-sm mt-1 block">${product.price}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Request Custom Project CTA */}
      {!isOwner && hasContent && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">Need something custom?</h4>
              <p className="text-xs text-muted-foreground">
                Describe your project and {creatorName?.split(' ')[0] || 'this creator'} will get back to you.
              </p>
            </div>
            <Button size="sm" onClick={() => {
              if (!user) { navigate('/auth'); return; }
              setShowProjectRequest(true);
            }}>
              Request
            </Button>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <CreateServiceDialog
        open={showAddService}
        onOpenChange={(v) => { setShowAddService(v); if (!v) setEditingService(null); }}
        onCreated={fetchData}
        editService={editingService}
      />

      {!isOwner && (
        <CustomProjectRequestDialog
          open={showProjectRequest}
          onOpenChange={setShowProjectRequest}
          creatorId={userId}
          creatorName={creatorName || 'Creator'}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>It won't be visible on your profile anymore.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── WhatsApp Business–style Service Card ───────────────────
function ServiceCard({
  service, isOwner, onEdit, onDelete
}: {
  service: CreatorService;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const lowestPrice = service.tiers.length > 0 ? Math.min(...service.tiers.map(t => t.price)) : null;
  const highestPrice = service.tiers.length > 0 ? Math.max(...service.tiers.map(t => t.price_max || t.price)) : null;
  const currency = service.tiers[0]?.currency || "USD";
  const currInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  const sym = currInfo?.symbol || "$";

  const formatPrice = (tier: ServiceTier) => {
    if (tier.price_max && tier.price_max > tier.price) {
      return `${sym}${tier.price} – ${sym}${tier.price_max}`;
    }
    return `${sym}${tier.price}`;
  };

  const priceDisplay = () => {
    if (!lowestPrice) return null;
    if (service.tiers.length === 1) return formatPrice(service.tiers[0]);
    if (lowestPrice === highestPrice) return `${sym}${lowestPrice}`;
    return `${sym}${lowestPrice} – ${sym}${highestPrice}`;
  };

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-all cursor-pointer group"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Hero image */}
      {service.cover_image_url && (
        <div className="aspect-[2.5/1] bg-muted overflow-hidden relative">
          <img src={service.cover_image_url} alt={service.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
          {service.service_format && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-sm">
              {service.service_format === 'virtual' ? '🌐 Virtual' : service.service_format === 'in_person' ? '📍 In Person' : '🌐📍 Both'}
            </Badge>
          )}
        </div>
      )}

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm line-clamp-1">{service.title}</h4>
            {service.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{service.description}</p>
            )}
          </div>

          {/* Owner actions */}
          {isOwner && (
            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Price bar */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t">
          <div className="flex items-center gap-2">
            {priceDisplay() && (
              <span className="text-sm font-bold text-primary">{priceDisplay()}</span>
            )}
            {currency !== "USD" && (
              <Badge variant="outline" className="text-[9px] h-4">{currency}</Badge>
            )}
          </div>
          {!isOwner && (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); }}>
              Book Now
            </Button>
          )}
          {!service.cover_image_url && service.service_format && (
            <Badge variant="secondary" className="text-[10px]">
              {service.service_format === 'virtual' ? 'Virtual' : service.service_format === 'in_person' ? 'In Person' : 'Both'}
            </Badge>
          )}
        </div>

        {/* Expanded tiers */}
        {expanded && service.tiers.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {service.tiers.map((tier) => (
              <div key={tier.id} className="rounded-lg border p-2.5 bg-muted/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{tier.tier_name}</span>
                  <span className="text-xs font-bold text-primary">{formatPrice(tier)}</span>
                </div>
                {tier.delivery_days && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                    <Clock className="h-2.5 w-2.5" />
                    {tier.delivery_days} day{tier.delivery_days !== 1 ? 's' : ''} delivery
                  </div>
                )}
                {tier.deliverables.length > 0 && (
                  <ul className="space-y-0.5">
                    {tier.deliverables.map((d, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!isOwner && (
                  <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs" onClick={e => e.stopPropagation()}>
                    Select · {formatPrice(tier)}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Expand hint */}
        {service.tiers.length > 1 && !expanded && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Tap to see {service.tiers.length} package options
          </p>
        )}
      </div>
    </Card>
  );
}
