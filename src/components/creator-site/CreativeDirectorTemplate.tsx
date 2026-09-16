import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const CreativeDirectorTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Creative Director';
  const displayBio = profile.site_bio || profile.bio || `${firstName} leads creative vision across brands and campaigns.`;

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

  return (
    <div className="bg-[#0d0d0d] text-[#e8e4df] min-h-dvh" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />

      {/* Minimal top bar */}
      <header className="flex justify-between items-center px-8 md:px-16 py-6 border-b border-white/5">
        <div className="text-sm font-light tracking-[0.4em] uppercase text-[#b8a080]">
          {profile.full_name}
        </div>
        <nav className="hidden md:flex gap-10 text-[11px] uppercase tracking-[0.3em] text-[#666]">
          {credits.length > 0 && <a href="#selected-work" className="hover:text-[#b8a080] transition-colors">Selected Work</a>}
          {services.length > 0 && <a href="#expertise" className="hover:text-[#b8a080] transition-colors">Expertise</a>}
          <a href="#contact" className="hover:text-[#b8a080] transition-colors">Contact</a>
        </nav>
        <button
          onClick={() => setShowInquiry(true)}
          className="text-[11px] uppercase tracking-[0.3em] text-[#b8a080] border border-[#b8a080]/30 px-5 py-2.5 hover:bg-[#b8a080] hover:text-[#0d0d0d] transition-all"
        >
          Let's Talk
        </button>
      </header>

      {/* Hero — cinematic split */}
      <section className="grid md:grid-cols-5 min-h-[85vh]">
        <div className="md:col-span-3 flex flex-col justify-center px-8 md:px-16 py-16 md:py-0">
          <p className="text-[11px] uppercase tracking-[0.5em] text-[#b8a080] mb-6">Creative Direction</p>
          <h1 className="text-4xl md:text-7xl font-light leading-[1.05] tracking-tight mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>
            {displayHeadline}
          </h1>
          <p className="text-base md:text-lg text-[#888] leading-relaxed max-w-[50ch] mb-10 whitespace-pre-line">
            {displayBio}
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-[#b8a080] text-[#0d0d0d] px-8 py-4 text-xs uppercase tracking-[0.25em] font-medium hover:bg-[#d4c4a8] transition-colors"
            >
              Start a Project
            </button>
            {profile.calendly_url && (
              <a
                href={profile.calendly_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-[#333] text-[#888] px-8 py-4 text-xs uppercase tracking-[0.25em] hover:border-[#b8a080] hover:text-[#b8a080] transition-colors"
              >
                Book a Call
              </a>
            )}
          </div>
        </div>
        <div className="md:col-span-2 relative">
          {profile.cover_image_url ? (
            <img src={profile.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1510] to-[#0d0d0d]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] to-transparent" />
        </div>
      </section>

      {/* Selected Work */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="selected-work" className="px-8 md:px-16 py-20 md:py-28 border-t border-white/5">
          <div className="flex justify-between items-end mb-12">
            <div>
              <p className="text-[11px] uppercase tracking-[0.5em] text-[#b8a080] mb-3">Portfolio</p>
              <h2 className="text-3xl md:text-5xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
                Selected Work
              </h2>
            </div>
            <p className="text-sm text-[#555] hidden md:block">{credits.length} projects</p>
          </div>
          <div className="grid md:grid-cols-2 gap-1">
            {credits.slice(0, 8).map((credit, i) => {
              const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
              return (
              <div key={credit.id} className="group relative aspect-[16/10] overflow-hidden bg-[#111]">
                {thumb ? (
                  <img
                    src={thumb}
                    alt={credit.project_name}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1510] to-[#0d0d0d]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-[#b8a080] mb-2">{credit.role}</p>
                  <h3 className="text-xl md:text-2xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {credit.project_name}
                  </h3>
                  {credit.year && <p className="text-xs text-[#666] mt-1">{credit.year}</p>}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Expertise / Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="expertise" className="px-8 md:px-16 py-20 md:py-28 border-t border-white/5">
          <p className="text-[11px] uppercase tracking-[0.5em] text-[#b8a080] mb-3">Expertise</p>
          <h2 className="text-3xl md:text-5xl font-light mb-12" style={{ fontFamily: "'Playfair Display', serif" }}>
            What I Do
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service) => (
              <div key={service.id} className="border-t border-white/10 pt-6 group">
                <h3 className="text-lg font-medium mb-3 group-hover:text-[#b8a080] transition-colors">{service.title}</h3>
                {service.description && (
                  <p className="text-sm text-[#666] leading-relaxed line-clamp-3">{service.description}</p>
                )}
                {service.tiers?.length > 0 && (
                  <p className="text-xs text-[#b8a080] mt-4">
                    From ${Math.min(...service.tiers.map((t: any) => t.price || 0))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-8 md:px-16 py-20 md:py-28 border-t border-white/5">
          <p className="text-[11px] uppercase tracking-[0.5em] text-[#b8a080] mb-3">Testimonials</p>
          <h2 className="text-3xl md:text-5xl font-light mb-12" style={{ fontFamily: "'Playfair Display', serif" }}>
            Client Words
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {allTestimonials.slice(0, 4).map((t, i) => (
              <blockquote key={i} className="border-l-2 border-[#b8a080]/30 pl-6">
                <p className="text-lg font-light italic leading-relaxed mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                  "{t.text}"
                </p>
                <footer className="text-sm">
                  <span className="text-[#b8a080]">{t.name}</span>
                  <span className="text-[#555] ml-2">— {t.role}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section id="contact" className="px-8 md:px-16 py-20 md:py-28 border-t border-white/5">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.5em] text-[#b8a080] mb-3">Get In Touch</p>
            <h2 className="text-3xl md:text-6xl font-light mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
              Let's create<br />something extraordinary.
            </h2>
            <div className="flex flex-wrap gap-4 mt-8">
              <button
                onClick={() => setShowInquiry(true)}
                className="bg-[#b8a080] text-[#0d0d0d] px-8 py-4 text-xs uppercase tracking-[0.25em] font-medium hover:bg-[#d4c4a8] transition-colors"
              >
                Start a Project
              </button>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="border border-[#333] text-[#888] px-8 py-4 text-xs uppercase tracking-[0.25em] hover:border-[#b8a080] hover:text-[#b8a080] transition-colors">
                  Website
                </a>
              )}
            </div>
            <div className="flex gap-6 mt-10 text-xs text-[#555]">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#b8a080] transition-colors uppercase tracking-[0.2em]">Instagram</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#b8a080] transition-colors uppercase tracking-[0.2em]">LinkedIn</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#b8a080] transition-colors uppercase tracking-[0.2em]">Twitter</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#b8a080] transition-colors uppercase tracking-[0.2em]">YouTube</a>}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="dark" accentColor="#b8a080" />
      )}
      <footer className="px-8 md:px-16 py-8 border-t border-white/5 flex justify-between items-center text-[10px] text-[#444] uppercase tracking-[0.3em]">
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
