import { CreatorSiteData } from "@/pages/CreatorSite";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const PhotographerTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Photographer';
  const displayBio = profile.site_bio || profile.bio || `${firstName} captures moments that tell powerful stories.`;

  const allTestimonials = [
    ...endorsements.filter(e => e.testimonial).map(e => ({
      text: e.testimonial,
      name: e.endorser_name || 'Collaborator',
      role: e.relationship || 'Industry Peer',
    })),
    ...reviews.filter(r => r.review_text).map(r => ({
      text: r.review_text,
      name: 'Verified Client',
      role: `${r.rating}★ Review`,
    })),
  ];

  const visualCredits = credits.filter(c => c.thumbnail_url || c.primary_media_url);

  return (
    <div className="bg-[#1a1a1a] text-white min-h-dvh" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Minimal floating nav */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="max-w-7xl mx-auto bg-black/60 backdrop-blur-xl rounded-full px-6 py-3 flex justify-between items-center border border-white/5">
          <span className="text-sm font-medium">{profile.full_name}</span>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-xs text-white/50">
              <a href="#portfolio" className="hover:text-white transition-colors">Portfolio</a>
              {services.length > 0 && <a href="#packages" className="hover:text-white transition-colors">Packages</a>}
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            </nav>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-white text-black px-4 py-1.5 text-xs font-medium rounded-full hover:bg-white/90 transition-colors"
            >
              Book Now
            </button>
          </div>
        </div>
      </header>

      {/* Hero — full-bleed image */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {profile.cover_image_url ? (
          <img src={profile.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : visualCredits.length > 0 ? (
          <img src={visualCredits[0].thumbnail_url || visualCredits[0].primary_media_url || ''} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a1a0a] to-[#1a1a1a]" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-6">
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-4">{displayHeadline}</h1>
          <p className="text-lg text-white/60 max-w-lg mx-auto whitespace-pre-line">{displayBio}</p>
          {profile.location && (
            <p className="text-xs text-white/30 mt-4 uppercase tracking-widest">Based in {profile.location}</p>
          )}
        </div>
      </section>

      {/* Portfolio Grid */}
      {isSectionVisible('credits') && visualCredits.length > 0 && (
        <section id="portfolio" className="px-2 md:px-4 py-16 md:py-24">
          <h2 className="text-center text-xs uppercase tracking-[0.4em] text-white/30 mb-10">Portfolio</h2>
          <div className="columns-2 md:columns-3 gap-2 space-y-2">
            {visualCredits.slice(0, 12).map((credit) => (
              <div
                key={credit.id}
                className="group relative overflow-hidden rounded-sm cursor-pointer break-inside-avoid"
                onClick={() => setLightboxImg(credit.thumbnail_url || credit.primary_media_url || '')}
              >
                <img
                  src={credit.thumbnail_url || credit.primary_media_url || ''}
                  alt={credit.project_name}
                  className="w-full h-auto group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                  <div className="p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-sm font-medium">{credit.project_name}</p>
                    <p className="text-xs text-white/60">{credit.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Non-visual credits */}
          {credits.filter(c => !c.thumbnail_url && !c.primary_media_url).length > 0 && (
            <div className="max-w-3xl mx-auto mt-12 px-4">
              <h3 className="text-xs uppercase tracking-[0.3em] text-white/20 mb-4">More Work</h3>
              <div className="space-y-2">
                {credits.filter(c => !c.thumbnail_url && !c.primary_media_url).slice(0, 6).map((credit) => (
                  <div key={credit.id} className="flex justify-between items-center py-2 border-b border-white/5 text-sm">
                    <span>{credit.project_name}</span>
                    <span className="text-white/30 text-xs">{credit.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Packages / Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="packages" className="px-6 md:px-16 py-16 md:py-24 border-t border-white/5">
          <h2 className="text-center text-xs uppercase tracking-[0.4em] text-white/30 mb-10">Packages</h2>
          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {services.map((service) => (
              <div key={service.id} className="bg-white/5 rounded-xl p-6 text-center border border-white/5 hover:border-white/20 transition-colors">
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                {service.description && (
                  <p className="text-sm text-white/50 leading-relaxed line-clamp-3 mb-4">{service.description}</p>
                )}
                {service.tiers?.length > 0 && (
                  <p className="text-2xl font-bold">
                    ${Math.min(...service.tiers.map((t: any) => t.price || 0))}
                    <span className="text-sm text-white/30 font-normal">+</span>
                  </p>
                )}
                <button
                  onClick={() => setShowInquiry(true)}
                  className="mt-4 w-full bg-white text-black py-2.5 text-xs font-medium rounded-lg hover:bg-white/90 transition-colors"
                >
                  Inquire
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-6 md:px-16 py-16 md:py-24 border-t border-white/5">
          <h2 className="text-center text-xs uppercase tracking-[0.4em] text-white/30 mb-10">Kind Words</h2>
          <div className="max-w-2xl mx-auto space-y-10">
            {allTestimonials.slice(0, 4).map((t, i) => (
              <div key={i} className="text-center">
                <p className="text-xl md:text-2xl font-light leading-relaxed mb-3">"{t.text}"</p>
                <p className="text-sm text-white/40">{t.name} · {t.role}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section id="contact" className="px-6 md:px-16 py-16 md:py-24 border-t border-white/5 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Let's Shoot.</h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto">Available for commissions, campaigns, and editorial shoots worldwide.</p>
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-white text-black px-8 py-4 text-sm font-medium rounded-full hover:bg-white/90 transition-colors"
          >
            Book a Session →
          </button>
          <div className="flex justify-center gap-6 mt-8 text-xs text-white/30">
            {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>}
            {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a>}
            {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a>}
            {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Website</a>}
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="dark" />
      )}
      <footer className="px-6 py-6 flex justify-between items-center text-[10px] text-white/15 uppercase tracking-widest">
        <span>© {new Date().getFullYear()} {profile.full_name}</span>
        <span>Powered by Kretopia</span>
      </footer>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" />
          <button className="absolute top-6 right-6 text-white/50 hover:text-white text-2xl">×</button>
        </div>
      )}

      <CustomProjectRequestDialog
        open={showInquiry}
        onOpenChange={setShowInquiry}
        creatorId={profile.user_id}
        creatorName={profile.full_name}
      />
    </div>
  );
};
