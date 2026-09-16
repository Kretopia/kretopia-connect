import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const MinimalCleanTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Creative Professional';
  const displayBio = profile.site_bio || profile.bio || `${firstName} crafts thoughtful, intentional work.`;

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
    <div className="bg-[#fcfcfc] text-[#222] min-h-dvh" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Minimal header */}
      <header className="max-w-3xl mx-auto px-6 py-10 flex justify-between items-center">
        <span className="text-sm font-medium">{profile.full_name}</span>
        <button
          onClick={() => setShowInquiry(true)}
          className="text-xs font-medium text-[#888] hover:text-[#222] transition-colors"
        >
          Get in Touch ↗
        </button>
      </header>

      {/* Hero — centered, restrained */}
      <section className="max-w-3xl mx-auto px-6 py-12 md:py-24">
        <div className="flex items-center gap-4 mb-8">
          {profile.avatar_url && (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-14 h-14 rounded-full object-cover" />
          )}
          {profile.location && (
            <span className="text-xs text-[#999]">{profile.location}</span>
          )}
        </div>
        <h1 className="text-3xl md:text-5xl font-semibold leading-tight tracking-tight mb-6">
          {displayHeadline}
        </h1>
        <p className="text-base md:text-lg text-[#666] leading-relaxed max-w-[55ch] whitespace-pre-line">
          {displayBio}
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-[#222] text-white px-6 py-3 text-sm font-medium rounded-lg hover:bg-[#444] transition-colors"
          >
            Work With Me
          </button>
          {profile.calendly_url && (
            <a href={profile.calendly_url} target="_blank" rel="noopener noreferrer"
              className="border border-[#ddd] px-6 py-3 text-sm font-medium rounded-lg text-[#666] hover:border-[#222] hover:text-[#222] transition-colors"
            >
              Book a Call
            </a>
          )}
        </div>
      </section>

      {/* Work */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 border-t border-[#eee]">
          <h2 className="text-sm font-medium text-[#999] mb-8">Selected Work</h2>
          <div className="space-y-6">
            {credits.slice(0, 10).map((credit) => {
              const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
              return (
              <div key={credit.id} className="flex items-start gap-4 group">
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium group-hover:text-[#555] transition-colors">{credit.project_name}</h3>
                  <p className="text-sm text-[#999]">{credit.role}{credit.year ? ` · ${credit.year}` : ''}</p>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 border-t border-[#eee]">
          <h2 className="text-sm font-medium text-[#999] mb-8">Services</h2>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between py-4 border-b border-[#f0f0f0] last:border-0">
                <div>
                  <h3 className="text-base font-medium">{service.title}</h3>
                  {service.description && (
                    <p className="text-sm text-[#999] mt-0.5 line-clamp-1">{service.description}</p>
                  )}
                </div>
                {service.tiers?.length > 0 && (
                  <span className="text-sm text-[#666] font-medium shrink-0 ml-4">
                    ${Math.min(...service.tiers.map((t: any) => t.price || 0))}+
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 border-t border-[#eee]">
          <h2 className="text-sm font-medium text-[#999] mb-8">Kind Words</h2>
          <div className="space-y-8">
            {allTestimonials.slice(0, 4).map((t, i) => (
              <div key={i}>
                <p className="text-base leading-relaxed mb-2">"{t.text}"</p>
                <p className="text-sm text-[#999]">{t.name}, {t.role}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 border-t border-[#eee]">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Let's work together.</h2>
          <p className="text-[#666] mb-6">I'm available for new projects and collaborations.</p>
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-[#222] text-white px-6 py-3 text-sm font-medium rounded-lg hover:bg-[#444] transition-colors"
          >
            Send a Message →
          </button>
          <div className="flex gap-4 mt-8 text-sm text-[#999]">
            {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#222] transition-colors">Instagram</a>}
            {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#222] transition-colors">LinkedIn</a>}
            {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#222] transition-colors">Twitter</a>}
            {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#222] transition-colors">YouTube</a>}
            {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#222] transition-colors">Website</a>}
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="light" />
      )}
      <footer className="max-w-3xl mx-auto px-6 py-8 flex justify-between items-center text-xs text-[#ccc]">
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
