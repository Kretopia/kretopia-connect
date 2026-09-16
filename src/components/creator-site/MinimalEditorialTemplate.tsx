import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const MinimalEditorialTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Creative Professional';
  const displayBio = profile.site_bio || profile.bio || `${firstName} brings a refined approach to every project.`;

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
    <div className="bg-[#faf9f7] text-[#1a1a1a] min-h-dvh" style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Nav */}
      <header className="flex justify-between items-center px-6 md:px-16 py-6" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="text-xs uppercase tracking-[0.3em] text-[#888]">
          {profile.full_name}
        </div>
        <nav className="hidden md:flex gap-10 text-xs uppercase tracking-[0.25em] text-[#888]">
          {credits.length > 0 && <a href="#work" className="hover:text-[#1a1a1a] transition-colors">Portfolio</a>}
          {services.length > 0 && <a href="#services" className="hover:text-[#1a1a1a] transition-colors">Services</a>}
          <a href="#contact" className="hover:text-[#1a1a1a] transition-colors">Contact</a>
        </nav>
        <button
          onClick={() => setShowInquiry(true)}
          className="text-xs uppercase tracking-[0.2em] border-b border-[#1a1a1a] pb-0.5 hover:border-[#888] hover:text-[#888] transition-colors"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Inquire
        </button>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-16 py-16 md:py-28 max-w-5xl">
        <h1 className="text-5xl md:text-[5.5rem] font-light leading-[1.05] tracking-tight mb-8">
          {displayHeadline}
        </h1>
        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-start">
          <p className="text-lg md:text-xl text-[#555] leading-relaxed font-light whitespace-pre-line" style={{ fontFamily: "'Inter', sans-serif" }}>
            {displayBio}
          </p>
          <div className="space-y-4">
            {profile.location && (
              <p className="text-xs uppercase tracking-[0.3em] text-[#888]" style={{ fontFamily: "'Inter', sans-serif" }}>
                Based in {profile.location}
              </p>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => setShowInquiry(true)}
                className="bg-[#1a1a1a] text-[#faf9f7] px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-[#333] transition-colors"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Start a Project
              </button>
              {profile.calendly_url && (
                <a
                  href={profile.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[#ccc] px-6 py-3 text-xs uppercase tracking-[0.2em] text-[#555] hover:border-[#1a1a1a] hover:text-[#1a1a1a] transition-colors"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Schedule Call
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Avatar / Featured Image */}
      {(profile.cover_image_url || profile.avatar_url) && (
        <section className="px-6 md:px-16 pb-16 md:pb-28">
          <img
            src={profile.cover_image_url || profile.avatar_url}
            alt={profile.full_name}
            className="w-full max-w-4xl aspect-[16/9] object-cover grayscale hover:grayscale-0 transition-all duration-700"
            loading="lazy"
          />
        </section>
      )}

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="services" className="px-6 md:px-16 py-16 md:py-24 border-t border-[#e5e3df]">
          <div className="max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-light mb-12 md:mb-20">Services</h2>
            <div className="space-y-0">
              {services.map((service, i) => {
                const lowestTier = service.tiers?.[0];
                const price = lowestTier ? `From ${lowestTier.currency || 'USD'} ${lowestTier.price}` : null;
                return (
                  <div
                    key={service.id}
                    className="py-8 border-b border-[#e5e3df] flex flex-col md:flex-row md:items-center justify-between gap-4 group cursor-pointer hover:pl-4 transition-all"
                    onClick={() => setShowInquiry(true)}
                  >
                    <div className="flex items-baseline gap-6">
                      <span className="text-xs text-[#bbb]" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-light group-hover:text-[#888] transition-colors">
                          {service.title}
                        </h3>
                        {service.description && (
                          <p className="text-sm text-[#888] mt-2 max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
                            {service.description.slice(0, 100)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {price && <span className="text-xs text-[#888] uppercase tracking-wider">{price}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Credits / Portfolio */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="work" className="px-6 md:px-16 py-16 md:py-24 border-t border-[#e5e3df]">
          <div className="max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-light mb-12 md:mb-20">Selected Work</h2>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              {credits.slice(0, 8).map((credit) => {
                const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
                return (
                <div key={credit.id} className="group">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={credit.project_name}
                      className="w-full aspect-[4/3] object-cover mb-4 grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-[#eee] mb-4 flex items-center justify-center">
                      <span className="text-2xl font-light text-[#ccc]">{credit.project_name?.[0]}</span>
                    </div>
                  )}
                  <h3 className="text-lg font-light">{credit.project_name}</h3>
                  <p className="text-xs text-[#888] mt-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {credit.role} {credit.year ? `— ${credit.year}` : ''}
                  </p>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-6 md:px-16 py-16 md:py-24 bg-[#f0eeea]">
          <div className="max-w-3xl">
            {allTestimonials.slice(0, 3).map((t, i) => (
              <div key={i} className={i > 0 ? "mt-16 pt-16 border-t border-[#ddd]" : ""}>
                <blockquote className="text-2xl md:text-3xl font-light leading-relaxed italic mb-6">
                  "{t.text}"
                </blockquote>
                <div style={{ fontFamily: "'Inter', sans-serif" }}>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-[#888]">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {profile.professional_skills && Array.isArray(profile.professional_skills) && profile.professional_skills.length > 0 && (
        <section className="px-6 md:px-16 py-16 md:py-24 border-t border-[#e5e3df]">
          <div className="max-w-5xl">
            <h2 className="text-xs uppercase tracking-[0.3em] text-[#888] mb-8" style={{ fontFamily: "'Inter', sans-serif" }}>Expertise</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(profile.professional_skills as any[]).slice(0, 12).map((skill: any, i: number) => (
                <span key={i} className="text-lg font-light text-[#555]">
                  {typeof skill === 'string' ? skill : skill.name || skill.label}
                  {i < Math.min((profile.professional_skills as any[]).length, 12) - 1 && <span className="ml-6 text-[#ccc]">/</span>}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Footer */}
      <footer id="contact" className="border-t border-[#e5e3df] px-6 md:px-16 py-16 md:py-24">
        <div className="max-w-5xl grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-3xl md:text-4xl font-light mb-4">Let's work together</h3>
            <p className="text-sm text-[#888] mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
              Open to new projects and collaborations.
            </p>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-[#1a1a1a] text-[#faf9f7] px-8 py-4 text-xs uppercase tracking-[0.2em] hover:bg-[#333] transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Get in Touch
            </button>
          </div>
          <div className="md:text-right space-y-3" style={{ fontFamily: "'Inter', sans-serif" }}>
            {profile.location && <p className="text-sm text-[#888]">{profile.location}</p>}
            {profile.website && (
              <p><a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#888] hover:text-[#1a1a1a] transition-colors underline underline-offset-4">{profile.website.replace(/^https?:\/\//, '')}</a></p>
            )}
            <div className="flex md:justify-end gap-6 mt-4">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors uppercase tracking-widest">Instagram</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors uppercase tracking-widest">LinkedIn</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors uppercase tracking-widest">X</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors uppercase tracking-widest">YouTube</a>}
              {profile.spotify_url && <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#1a1a1a] transition-colors uppercase tracking-widest">Spotify</a>}
            </div>
          </div>
        </div>
        {profile.site_custom_blocks?.length > 0 && (
          <BlockRenderer blocks={profile.site_custom_blocks} theme="light" />
        )}
        <div className="mt-16 pt-8 border-t border-[#e5e3df] text-center">
          <a
            href="https://www.kretopia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#bbb] hover:text-[#888] transition-colors uppercase tracking-[0.3em]"
            style={{ fontFamily: "'Inter', sans-serif" }}
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
