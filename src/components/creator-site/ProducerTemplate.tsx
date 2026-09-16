import { CreatorSiteData } from "@/pages/CreatorSite";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const ProducerTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Producer';
  const displayBio = profile.site_bio || profile.bio || `${firstName} produces world-class creative projects.`;

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
    <div className="bg-[#fefefe] text-[#111] min-h-dvh" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />

      {/* Sticky nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#eee]">
        <div className="flex justify-between items-center px-6 md:px-16 py-4 max-w-7xl mx-auto">
          <div className="text-sm font-semibold tracking-tight">{profile.full_name}</div>
          <nav className="hidden md:flex gap-8 text-xs font-medium text-[#888]">
            {credits.length > 0 && <a href="#filmography" className="hover:text-[#111] transition-colors">Filmography</a>}
            {services.length > 0 && <a href="#services" className="hover:text-[#111] transition-colors">Services</a>}
            <a href="#contact" className="hover:text-[#111] transition-colors">Contact</a>
          </nav>
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-[#111] text-white px-5 py-2 text-xs font-medium rounded-lg hover:bg-[#333] transition-colors"
          >
            Hire Me
          </button>
        </div>
      </header>

      {/* Hero — stats-focused */}
      <section className="px-6 md:px-16 py-16 md:py-28 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6" style={{ fontFamily: "'DM Serif Display', serif" }}>
              {displayHeadline}
            </h1>
            <p className="text-base md:text-lg text-[#666] leading-relaxed max-w-[50ch] mb-8 whitespace-pre-line">
              {displayBio}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowInquiry(true)}
                className="bg-[#111] text-white px-8 py-3.5 text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
              >
                Start a Project →
              </button>
              {profile.calendly_url && (
                <a href={profile.calendly_url} target="_blank" rel="noopener noreferrer"
                  className="border border-[#ddd] text-[#666] px-8 py-3.5 text-sm font-medium rounded-lg hover:border-[#111] hover:text-[#111] transition-colors"
                >
                  Schedule Call
                </a>
              )}
            </div>
          </div>
          {/* Stats panel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#f5f5f5] rounded-2xl p-6 text-center">
              <p className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{credits.length}</p>
              <p className="text-xs text-[#888] mt-1 font-medium">Projects</p>
            </div>
            <div className="bg-[#f5f5f5] rounded-2xl p-6 text-center">
              <p className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{endorsements.length}</p>
              <p className="text-xs text-[#888] mt-1 font-medium">Endorsements</p>
            </div>
            <div className="bg-[#f5f5f5] rounded-2xl p-6 text-center">
              <p className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>{services.length}</p>
              <p className="text-xs text-[#888] mt-1 font-medium">Services</p>
            </div>
            <div className="bg-[#f5f5f5] rounded-2xl p-6 text-center">
              <p className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '—'}
              </p>
              <p className="text-xs text-[#888] mt-1 font-medium">Avg Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filmography — horizontal scroll */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="filmography" className="py-16 md:py-24 border-t border-[#eee]">
          <div className="px-6 md:px-16 max-w-7xl mx-auto mb-8">
            <h2 className="text-2xl md:text-4xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>Filmography</h2>
          </div>
          <div className="overflow-x-auto px-6 md:px-16 pb-4">
            <div className="flex gap-4" style={{ width: 'max-content' }}>
              {credits.slice(0, 12).map((credit) => (
                <div key={credit.id} className="w-[260px] shrink-0 group">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#f0f0f0] mb-3">
                    {credit.thumbnail_url || credit.primary_media_url ? (
                      <img
                        src={credit.thumbnail_url || credit.primary_media_url || ''}
                        alt={credit.project_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#e0e0e0] to-[#ccc] flex flex-col items-center justify-center p-6 text-center">
                        <p className="text-sm font-bold text-[#888]">{credit.project_name}</p>
                        <p className="text-xs text-[#aaa] mt-1">{credit.role}</p>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold">{credit.project_name}</h3>
                  <p className="text-xs text-[#888]">{credit.role} {credit.year ? `· ${credit.year}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="services" className="px-6 md:px-16 py-16 md:py-24 max-w-7xl mx-auto border-t border-[#eee]">
          <h2 className="text-2xl md:text-4xl font-bold mb-10" style={{ fontFamily: "'DM Serif Display', serif" }}>Services</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {services.map((service) => (
              <div key={service.id} className="border border-[#eee] rounded-xl p-6 hover:border-[#ccc] hover:shadow-sm transition-all">
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                {service.description && (
                  <p className="text-sm text-[#666] leading-relaxed line-clamp-2">{service.description}</p>
                )}
                {service.tiers?.length > 0 && (
                  <p className="text-sm font-medium mt-4">
                    From <span className="text-[#111]">${Math.min(...service.tiers.map((t: any) => t.price || 0))}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-6 md:px-16 py-16 md:py-24 max-w-7xl mx-auto border-t border-[#eee]">
          <h2 className="text-2xl md:text-4xl font-bold mb-10" style={{ fontFamily: "'DM Serif Display', serif" }}>Reviews</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {allTestimonials.slice(0, 6).map((t, i) => (
              <div key={i} className="bg-[#f8f8f8] rounded-xl p-6">
                <p className="text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="border-t border-[#eee] pt-3">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-[#888]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section id="contact" className="px-6 md:px-16 py-16 md:py-24 max-w-7xl mx-auto border-t border-[#eee]">
          <div className="bg-[#111] text-white rounded-2xl p-8 md:p-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'DM Serif Display', serif" }}>
              Ready to Produce?
            </h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">Let's bring your next project to life with professional execution.</p>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-white text-[#111] px-8 py-4 text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors"
            >
              Start Your Project →
            </button>
            <div className="flex justify-center gap-6 mt-8 text-xs text-white/40">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LinkedIn</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a>}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="light" />
      )}
      <footer className="px-6 md:px-16 py-6 flex justify-between items-center text-xs text-[#bbb] max-w-7xl mx-auto">
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
