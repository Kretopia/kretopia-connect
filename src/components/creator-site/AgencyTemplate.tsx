import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

export const AgencyTemplate = ({ data }: { data: CreatorSiteData }) => {
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);
  const firstName = profile.full_name?.split(' ')[0] || 'Creator';

  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Creative Studio';
  const displayBio = profile.site_bio || profile.bio || `${firstName} delivers exceptional creative solutions for forward-thinking brands.`;

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
    <div className="bg-white text-[#111] min-h-dvh" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <header className="flex justify-between items-center px-6 md:px-16 py-6">
        <div className="text-lg font-black tracking-tight uppercase">{profile.full_name}</div>
        <nav className="hidden md:flex gap-8 text-xs font-semibold uppercase tracking-widest text-[#999]">
          {credits.length > 0 && <a href="#work" className="hover:text-[#111] transition-colors">Work</a>}
          {services.length > 0 && <a href="#capabilities" className="hover:text-[#111] transition-colors">Capabilities</a>}
          <a href="#contact" className="hover:text-[#111] transition-colors">Contact</a>
        </nav>
        <button
          onClick={() => setShowInquiry(true)}
          className="bg-[#111] text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
        >
          Brief Us
        </button>
      </header>

      {/* Hero — bold type */}
      <section className="px-6 md:px-16 py-16 md:py-32">
        <h1 className="text-5xl md:text-[8rem] font-black leading-[0.85] tracking-tighter uppercase mb-8">
          {displayHeadline}
        </h1>
        <div className="grid md:grid-cols-3 gap-8 items-start mt-12">
          <p className="md:col-span-2 text-lg md:text-xl text-[#666] leading-relaxed max-w-[60ch] whitespace-pre-line">
            {displayBio}
          </p>
          <div className="space-y-4">
            <button
              onClick={() => setShowInquiry(true)}
              className="w-full bg-[#111] text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
            >
              Start a Project
            </button>
            {profile.calendly_url && (
              <a href={profile.calendly_url} target="_blank" rel="noopener noreferrer"
                className="block w-full border-2 border-[#111] text-center px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-colors"
              >
                Book a Call
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Marquee-style stats bar */}
      <div className="bg-[#111] text-white py-6 overflow-hidden">
        <div className="flex gap-16 px-16 items-center text-sm font-medium">
          <span>{credits.length} Projects Delivered</span>
          <span className="text-white/20">·</span>
          <span>{endorsements.length} Endorsements</span>
          <span className="text-white/20">·</span>
          <span>{services.length} Services Available</span>
          {reviews.length > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>{(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}★ Average Rating</span>
            </>
          )}
        </div>
      </div>

      {/* Case Studies / Work */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="work" className="px-6 md:px-16 py-16 md:py-28">
          <div className="flex justify-between items-end mb-12">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Selected Work</h2>
          </div>
          <div className="space-y-2">
            {credits.slice(0, 10).map((credit, i) => {
              const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
              return (
              <div key={credit.id} className="group grid md:grid-cols-[auto_1fr_auto] gap-4 items-center py-6 border-b border-[#eee] hover:border-[#111] transition-colors cursor-default">
                <span className="text-xs font-mono text-[#ccc] w-8">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex items-center gap-4">
                  {thumb && (
                    <img
                      src={thumb}
                      alt=""
                      className="w-12 h-12 rounded object-cover opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                  <div>
                    <h3 className="text-lg md:text-xl font-bold group-hover:translate-x-2 transition-transform">{credit.project_name}</h3>
                    <p className="text-xs text-[#999] font-medium uppercase tracking-wider">{credit.role}</p>
                  </div>
                </div>
                <span className="text-sm text-[#ccc] font-medium">{credit.year || ''}</span>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Capabilities */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="capabilities" className="px-6 md:px-16 py-16 md:py-28 bg-[#f8f8f8]">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-12">Capabilities</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="bg-white p-8 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                {service.description && (
                  <p className="text-sm text-[#666] leading-relaxed line-clamp-3">{service.description}</p>
                )}
                {service.tiers?.length > 0 && (
                  <p className="text-sm font-bold mt-4 border-t border-[#eee] pt-4">
                    Starting at ${Math.min(...service.tiers.map((t: any) => t.price || 0))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-6 md:px-16 py-16 md:py-28">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-12">Client Reviews</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {allTestimonials.slice(0, 4).map((t, i) => (
              <div key={i} className="border-l-4 border-[#111] pl-6">
                <p className="text-lg leading-relaxed mb-4">"{t.text}"</p>
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-[#999]">{t.role}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {isSectionVisible('contact') && (
        <section id="contact" className="px-6 md:px-16 py-16 md:py-28 bg-[#111] text-white">
          <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-6">
            Have a project<br />in mind?
          </h2>
          <p className="text-lg text-white/50 mb-8 max-w-lg">We're ready to bring your vision to life. Get in touch and let's make it happen.</p>
          <button
            onClick={() => setShowInquiry(true)}
            className="bg-white text-[#111] px-10 py-4 text-xs font-bold uppercase tracking-widest hover:bg-white/90 transition-colors"
          >
            Brief Us →
          </button>
          <div className="flex gap-8 mt-12 text-xs text-white/30 uppercase tracking-widest">
            {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">IG</a>}
            {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">IN</a>}
            {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">TW</a>}
            {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YT</a>}
            {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WEB</a>}
          </div>
        </section>
      )}

      {/* Footer */}
      {profile.site_custom_blocks?.length > 0 && (
        <BlockRenderer blocks={profile.site_custom_blocks} theme="light" />
      )}
      <footer className="px-6 md:px-16 py-6 flex justify-between items-center text-xs text-[#ccc]">
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
