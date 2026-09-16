import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

const getCategoryColor = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'film & tv': return 'bg-primary text-primary';
    case 'music': return 'bg-primary text-primary';
    case 'photography': return 'bg-amber-100 text-amber-800';
    case 'design': return 'bg-teal-100 text-teal-800';
    case 'events': return 'bg-rose-100 text-rose-800';
    default: return 'bg-zinc-100 text-zinc-700';
  }
};

export const PortfolioMosaicTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || `Hi, I'm ${firstName}`;
  const displayBio = profile.site_bio || profile.bio || `${firstName} creates compelling work across multiple disciplines.`;

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
    <div className="bg-white text-[#111] min-h-dvh" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Sticky Nav */}
      <header className="sticky top-0 z-50 bg-white border-b border-zinc-100">
        <div className="flex justify-between items-center px-5 md:px-10 py-4">
          <div className="flex items-center gap-3">
            {profile.avatar_url && (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            )}
            <span className="font-semibold text-sm">{profile.full_name}</span>
          </div>
          <nav className="hidden md:flex gap-8 text-xs font-medium text-zinc-500">
            {credits.length > 0 && <a href="#work" className="hover:text-[#111] transition-colors">Work</a>}
            {services.length > 0 && <a href="#services" className="hover:text-[#111] transition-colors">Services</a>}
            <a href="#contact" className="hover:text-[#111] transition-colors">Contact</a>
          </nav>
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-[#111] text-white px-5 py-2 rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Hire {firstName}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 md:px-10 py-12 md:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[1.2fr,1fr] gap-10 md:gap-16 items-center">
          <div>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">
              {profile.location || 'Creative Professional'}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
              {displayHeadline}
            </h1>
            <p className="text-base md:text-lg text-zinc-500 leading-relaxed max-w-lg mb-8 whitespace-pre-line">
              {displayBio}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowInquiry(true)}
                className="bg-[#111] text-white px-7 py-3.5 rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Start a Project
              </button>
              {profile.calendly_url && (
                <a
                  href={profile.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-zinc-200 px-7 py-3.5 rounded-full text-sm font-medium text-zinc-600 hover:border-zinc-400 transition-colors"
                >
                  Book a Call
                </a>
              )}
            </div>
          </div>
          {(profile.cover_image_url || profile.avatar_url) && (
            <div className="relative">
              <img
                src={profile.cover_image_url || profile.avatar_url}
                alt={profile.full_name}
                className="w-full aspect-square md:aspect-[3/4] object-cover rounded-2xl"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </section>

      {/* Portfolio Masonry */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="work" className="px-5 md:px-10 py-12 md:py-20 bg-zinc-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-10" style={{ fontFamily: "'Playfair Display', serif" }}>
              Portfolio
            </h2>
            <div className="columns-2 md:columns-3 gap-4 space-y-4">
              {credits.slice(0, 12).map((credit) => {
                const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
                return (
                <div key={credit.id} className="break-inside-avoid group relative rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg transition-shadow">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={credit.project_name}
                      className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full aspect-[3/4] ${getCategoryColor(credit.credit_category)} flex items-center justify-center p-6`}>
                      <span className="text-center font-medium">{credit.project_name}</span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-sm">{credit.project_name}</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      {credit.role} {credit.year ? `· ${credit.year}` : ''}
                    </p>
                    {credit.credit_category && (
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${getCategoryColor(credit.credit_category)}`}>
                        {credit.credit_category}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="services" className="px-5 md:px-10 py-12 md:py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-10" style={{ fontFamily: "'Playfair Display', serif" }}>
              Services
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((service) => {
                const lowestTier = service.tiers?.[0];
                const price = lowestTier ? `From ${lowestTier.currency || 'USD'} ${lowestTier.price}` : null;
                return (
                  <div
                    key={service.id}
                    className="bg-zinc-50 rounded-2xl p-6 hover:bg-zinc-100 transition-colors cursor-pointer group"
                    onClick={() => setShowInquiry(true)}
                  >
                    {service.cover_image_url && (
                      <img src={service.cover_image_url} alt="" className="w-full aspect-video object-cover rounded-xl mb-4" loading="lazy" />
                    )}
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-zinc-600 transition-colors">{service.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed mb-3">
                      {service.description?.slice(0, 100) || 'Get in touch for details.'}
                    </p>
                    <div className="flex items-center justify-between">
                      {price && <span className="text-xs font-medium text-zinc-400">{price}</span>}
                      {service.delivery_time && <span className="text-xs text-zinc-400">{service.delivery_time}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-5 md:px-10 py-12 md:py-20 bg-[#111] text-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-12" style={{ fontFamily: "'Playfair Display', serif" }}>
              Kind Words
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {allTestimonials.slice(0, 4).map((t, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <p className="text-sm text-zinc-300 leading-relaxed mb-4">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                      {t.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-zinc-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Skills */}
      {profile.professional_skills && Array.isArray(profile.professional_skills) && profile.professional_skills.length > 0 && (
        <section className="px-5 md:px-10 py-12 md:py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-6">Skills & Expertise</h2>
            <div className="flex flex-wrap gap-2">
              {(profile.professional_skills as any[]).slice(0, 12).map((skill: any, i: number) => (
                <span key={i} className="bg-zinc-100 px-4 py-2 rounded-full text-sm font-medium text-zinc-600">
                  {typeof skill === 'string' ? skill : skill.name || skill.label}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="light" />
      )}
      <footer id="contact" className="border-t border-zinc-100 px-5 md:px-10 py-12 md:py-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Let's create something great
            </h3>
            <p className="text-zinc-500 mb-6">Available for new projects and collaborations.</p>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-[#111] text-white px-8 py-4 rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Get in Touch
            </button>
          </div>
          <div className="md:text-right space-y-3 text-sm text-zinc-500">
            {profile.location && <p>{profile.location}</p>}
            {profile.website && (
              <p><a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#111] transition-colors underline underline-offset-4">{profile.website.replace(/^https?:\/\//, '')}</a></p>
            )}
            <div className="flex md:justify-end gap-5 mt-4">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#111] transition-colors text-xs font-medium">Instagram</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#111] transition-colors text-xs font-medium">LinkedIn</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#111] transition-colors text-xs font-medium">X</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#111] transition-colors text-xs font-medium">YouTube</a>}
              {profile.spotify_url && <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#111] transition-colors text-xs font-medium">Spotify</a>}
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-16 pt-8 border-t border-zinc-100 text-center">
          <a
            href="https://www.kretopia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-zinc-300 hover:text-zinc-500 transition-colors uppercase tracking-[0.3em] font-medium"
          >
            Powered by Kretopia
          </a>
        </div>
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
