import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const ArtistShowcaseTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Artist';
  const displayBio = profile.site_bio || profile.bio || `${firstName} creates bold, boundary-pushing work.`;

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

  const visualCredits = credits.filter(c => resolveCreditThumbnail(c.thumbnail_url, c.primary_media_url, c.url));
  const textCredits = credits.filter(c => !resolveCreditThumbnail(c.thumbnail_url, c.primary_media_url, c.url));

  return (
    <div className="bg-[#111] text-white min-h-dvh">
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Floating nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111] border-b border-white/5">
        <div className="flex justify-between items-center px-6 md:px-12 py-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <div className="text-sm font-medium tracking-wider">{profile.full_name}</div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-6 text-xs text-white/50">
              <a href="#gallery" className="hover:text-white transition-colors">Gallery</a>
              {services.length > 0 && <a href="#services" className="hover:text-white transition-colors">Services</a>}
              <a href="#about" className="hover:text-white transition-colors">About</a>
            </nav>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-white text-black px-5 py-2 text-xs font-medium rounded-full hover:bg-white/90 transition-colors"
            >
              Commission
            </button>
          </div>
        </div>
      </header>

      {/* Hero — immersive full-screen */}
      <section className="relative min-h-dvh flex items-end" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {profile.cover_image_url ? (
          <img src={profile.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a2e] via-[#111] to-[#0a1628]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-[#111]/30 to-transparent" />
        <div className="relative z-10 px-6 md:px-12 pb-16 md:pb-24 w-full">
          <h1 className="text-5xl md:text-[7rem] font-bold leading-[0.9] tracking-tight mb-4">
            {displayHeadline}
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-[55ch] whitespace-pre-line">
            {displayBio}
          </p>
          {profile.location && (
            <p className="text-xs text-white/30 mt-4 uppercase tracking-widest">{profile.location}</p>
          )}
        </div>
      </section>

      {/* Gallery Grid */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="gallery" className="px-4 md:px-8 py-16 md:py-24" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <h2 className="text-xs uppercase tracking-[0.4em] text-white/30 mb-10 px-2">Featured Work</h2>
          
          {/* Visual credits — masonry-ish grid */}
          {visualCredits.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
              {visualCredits.slice(0, 9).map((credit, i) => (
                <div
                  key={credit.id}
                  className={`group relative overflow-hidden rounded-lg ${
                    i === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-[4/5]'
                  }`}
                >
                  <img
                    src={resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url) || ''}
                    alt={credit.project_name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-sm font-medium">{credit.project_name}</p>
                    <p className="text-xs text-white/60">{credit.role}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Text credits */}
          {textCredits.length > 0 && (
            <div className="grid md:grid-cols-4 gap-4 mt-8">
              {textCredits.slice(0, 8).map((credit) => (
                <div key={credit.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <p className="text-sm font-medium">{credit.project_name}</p>
                  <p className="text-xs text-white/40 mt-1">{credit.role}</p>
                  {credit.year && <p className="text-xs text-white/20 mt-2">{credit.year}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="services" className="px-6 md:px-12 py-16 md:py-24 border-t border-white/5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <h2 className="text-xs uppercase tracking-[0.4em] text-white/30 mb-10">Services</h2>
          <div className="space-y-0">
            {services.map((service) => (
              <div key={service.id} className="group flex items-center justify-between py-6 border-b border-white/5 hover:border-white/20 transition-colors">
                <div>
                  <h3 className="text-xl md:text-2xl font-medium group-hover:text-white/90">{service.title}</h3>
                  {service.description && (
                    <p className="text-sm text-white/40 mt-1 max-w-lg line-clamp-1">{service.description}</p>
                  )}
                </div>
                {service.tiers?.length > 0 && (
                  <span className="text-sm text-white/30 font-medium">
                    From ${Math.min(...service.tiers.map((t: any) => t.price || 0))}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About / Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section id="about" className="px-6 md:px-12 py-16 md:py-24 border-t border-white/5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <h2 className="text-xs uppercase tracking-[0.4em] text-white/30 mb-10">What People Say</h2>
          <div className="space-y-12">
            {allTestimonials.slice(0, 3).map((t, i) => (
              <div key={i} className="max-w-2xl">
                <p className="text-2xl md:text-3xl font-light leading-snug mb-4">"{t.text}"</p>
                <p className="text-sm text-white/40">{t.name} · {t.role}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section className="px-6 md:px-12 py-16 md:py-24 border-t border-white/5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <div className="max-w-3xl">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-8">
              Want to work<br />together?
            </h2>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-white text-black px-8 py-4 text-sm font-medium rounded-full hover:bg-white/90 transition-colors"
            >
              Get in Touch →
            </button>
            <div className="flex gap-6 mt-10 text-xs text-white/30">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a>}
              {profile.spotify_url && <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Spotify</a>}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="dark" />
      )}
      <footer className="px-6 md:px-12 py-6 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        <span>© {new Date().getFullYear()} {profile.full_name}</span>
        <span>Powered by Kretopia</span>
      </footer>

      <CustomProjectRequestDialog
        open={showInquiry}
        onOpenChange={setShowInquiry}
        creatorId={profile.user_id}
        creatorName={profile.full_name}
      />
    </div>
  );
};
