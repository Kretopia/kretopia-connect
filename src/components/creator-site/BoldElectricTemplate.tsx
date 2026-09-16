import { CreatorSiteData } from "@/pages/CreatorSite";
import { resolveCreditThumbnail } from "@/lib/thumbnailExtractor";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CustomProjectRequestDialog } from "@/components/profile/CustomProjectRequestDialog";

const getCategoryGradient = (category?: string) => {
  switch (category?.toLowerCase()) {
    case 'film & tv': return 'from-slate-800 to-primary';
    case 'music': return 'from-primary to-primary';
    case 'photography': return 'from-amber-900 to-orange-800';
    case 'design': return 'from-teal-900 to-primary';
    case 'events': return 'from-rose-900 to-pink-800';
    default: return 'from-zinc-800 to-zinc-700';
  }
};

export const BoldElectricTemplate = ({ data }: { data: CreatorSiteData }) => {
  const navigate = useNavigate();
  const { profile, services, credits, reviews, endorsements } = data;
  const [showInquiry, setShowInquiry] = useState(false);

  const firstName = profile.full_name?.split(' ')[0] || 'Creator';
  const sections = Array.isArray(profile.site_sections) ? profile.site_sections : [];
  const isSectionVisible = (id: string) => {
    const section = sections.find((s: any) => s.id === id);
    return section ? section.visible !== false : true;
  };
  const displayHeadline = profile.site_headline || profile.role || 'Creative Professional';
  const displayBio = profile.site_bio || profile.bio || `${firstName} is a creative professional ready to bring your vision to life.`;

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
    <div className="bg-[#0a0a0c] text-white font-sans antialiased min-h-dvh">
      {/* Nav */}
      <header className="flex justify-between items-center p-6 md:p-8">
        <div className="text-xl md:text-2xl font-bold tracking-tighter uppercase">
          {profile.full_name?.split(' ').join('.')}
        </div>
        <nav className="hidden md:flex gap-8 text-xs uppercase tracking-widest text-zinc-400">
          <a href="#work" className="hover:text-[#00ffff] transition-colors">Work</a>
          <a href="#services" className="hover:text-[#00ffff] transition-colors">Services</a>
          <a href="#contact" className="hover:text-[#00ffff] transition-colors">Contact</a>
        </nav>
        <button
          onClick={() => setShowInquiry(true)}
          className="md:hidden text-xs uppercase tracking-widest text-[#ff00ff] border border-[#ff00ff]/30 px-4 py-2 hover:bg-[#ff00ff] hover:text-black transition-colors"
        >
          Hire Me
        </button>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-16 py-12 md:py-20 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-8xl font-bold leading-[0.9] tracking-tighter uppercase">
            {displayHeadline}
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-[45ch] leading-relaxed whitespace-pre-line">
            {displayBio}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-[#ff00ff] text-black px-6 md:px-8 py-3 md:py-4 font-bold uppercase text-sm tracking-widest hover:bg-white transition-colors"
            >
              Start a Project
            </button>
            {profile.calendly_url && (
              <a
                href={profile.calendly_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-zinc-700 px-6 md:px-8 py-3 md:py-4 text-sm uppercase tracking-widest text-zinc-300 hover:border-[#00ffff] hover:text-[#00ffff] transition-colors"
              >
                Book a Call
              </a>
            )}
          </div>
          {profile.location && (
            <p className="text-xs uppercase tracking-widest text-zinc-600">{profile.location}</p>
          )}
        </div>
        <div className="relative">
          {profile.cover_image_url || profile.avatar_url ? (
            <div className="bg-zinc-900 p-2 rounded-sm rotate-1 hover:rotate-0 transition-transform duration-500">
              <img
                src={profile.cover_image_url || profile.avatar_url}
                alt={profile.full_name}
                className="w-full aspect-[4/3] object-cover contrast-110"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#ff00ff]/20 to-[#00ffff]/20 aspect-[4/3] rounded-sm flex items-center justify-center">
              <span className="text-6xl font-bold text-zinc-700">{firstName[0]}</span>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      {isSectionVisible('services') && services.length > 0 && (
        <section id="services" className="px-6 md:px-16 py-12 md:py-20">
          <h2 className="text-xs uppercase tracking-[0.5em] text-[#00ffff] mb-10 md:mb-16">Available Services</h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {services.map((service) => {
              const lowestTier = service.tiers?.[0];
              const price = lowestTier ? `${lowestTier.currency || 'USD'} ${lowestTier.price}` : null;
              return (
                <div
                  key={service.id}
                  className="border border-zinc-800 p-6 md:p-8 hover:border-[#00ffff] transition-colors group cursor-pointer"
                  onClick={() => setShowInquiry(true)}
                >
                  {price && (
                    <div className="text-xs mb-3 md:mb-4 text-zinc-500">From {price}</div>
                  )}
                  <h3 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 group-hover:text-[#00ffff] transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {service.description?.slice(0, 120) || 'Get in touch for details.'}
                  </p>
                  {service.delivery_time && (
                    <p className="text-xs text-zinc-600 mt-4">⏱ {service.delivery_time}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Credits / Work */}
      {isSectionVisible('credits') && credits.length > 0 && (
        <section id="work" className="px-6 md:px-16 py-12 md:py-20">
          <h2 className="text-xs uppercase tracking-[0.5em] text-[#ff00ff] mb-10 md:mb-16">Featured Work</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {credits.map((credit) => {
              const thumb = resolveCreditThumbnail(credit.thumbnail_url, credit.primary_media_url, credit.url);
              return (
              <div
                key={credit.id}
                className="group relative overflow-hidden bg-zinc-900 cursor-pointer"
                onClick={() => navigate(`/profile/${profile.user_id}`)}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={credit.project_name}
                    className="w-full aspect-[2/3] object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full aspect-[2/3] bg-gradient-to-br ${getCategoryGradient(credit.credit_category)} flex items-center justify-center p-4`}>
                    <span className="text-sm font-medium text-center text-white/70">{credit.project_name}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 md:p-4">
                  <p className="text-xs md:text-sm font-bold truncate">{credit.project_name}</p>
                  <p className="text-[10px] md:text-xs text-zinc-400">{credit.role} {credit.year ? `· ${credit.year}` : ''}</p>
                  {credit.verification_status === 'verified' && (
                    <span className="text-[8px] text-[#00ffff] uppercase tracking-wider">✓ Verified</span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {isSectionVisible('testimonials') && allTestimonials.length > 0 && (
        <section className="px-6 md:px-16 py-12 md:py-20 bg-[#0f0f12]">
          <h2 className="text-xs uppercase tracking-[0.5em] text-[#00ffff] mb-10 md:mb-16">What People Say</h2>
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-4xl">
            {allTestimonials.slice(0, 4).map((t, i) => (
              <div key={i} className="border border-zinc-800 p-6 md:p-8">
                <p className="text-zinc-300 italic mb-6 leading-relaxed text-sm md:text-base">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#ff00ff]/20 flex items-center justify-center text-[#ff00ff] font-bold text-sm">
                    {t.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {profile.professional_skills && Array.isArray(profile.professional_skills) && profile.professional_skills.length > 0 && (
        <section className="px-6 md:px-16 py-12 md:py-20">
          <h2 className="text-xs uppercase tracking-[0.5em] text-zinc-500 mb-8">Expertise</h2>
          <div className="flex flex-wrap gap-2">
            {(profile.professional_skills as any[]).slice(0, 12).map((skill: any, i: number) => (
              <span key={i} className="border border-zinc-800 px-4 py-2 text-xs uppercase tracking-widest text-zinc-400 hover:border-[#ff00ff] hover:text-[#ff00ff] transition-colors">
                {typeof skill === 'string' ? skill : skill.name || skill.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Contact Footer */}
      <footer id="contact" className="border-t border-zinc-800 px-6 md:px-16 py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16">
          <div className="space-y-4">
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight">Let's align.</h3>
            <p className="text-zinc-500">Available for projects and collaborations.</p>
            <button
              onClick={() => setShowInquiry(true)}
              className="bg-[#ff00ff] text-black px-8 py-4 font-bold uppercase text-sm tracking-widest hover:bg-white transition-colors mt-4"
            >
              Get in Touch
            </button>
          </div>
          <div className="md:text-right text-sm text-zinc-400 space-y-2">
            {profile.location && <p>{profile.location}</p>}
            {profile.website && (
              <p><a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#00ffff] transition-colors">{profile.website.replace(/^https?:\/\//, '')}</a></p>
            )}
            <div className="flex md:justify-end gap-4 mt-4">
              {profile.instagram_url && <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#ff00ff] transition-colors text-xs uppercase tracking-widest">IG</a>}
              {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#ff00ff] transition-colors text-xs uppercase tracking-widest">LI</a>}
              {profile.twitter_url && <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#ff00ff] transition-colors text-xs uppercase tracking-widest">X</a>}
              {profile.youtube_url && <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#ff00ff] transition-colors text-xs uppercase tracking-widest">YT</a>}
              {profile.spotify_url && <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-[#ff00ff] transition-colors text-xs uppercase tracking-widest">SP</a>}
            </div>
          </div>
        </div>

        {/* Custom Blocks */}
        {profile.site_custom_blocks?.length > 0 && (
          <BlockRenderer blocks={profile.site_custom_blocks} theme="dark" accentColor="#ff00ff" />
        )}

        {/* Powered by Kretopia */}
        <div className="mt-12 md:mt-20 pt-8 border-t border-zinc-900 text-center">
          <a
            href="https://www.kretopia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-[#ff00ff] transition-colors uppercase tracking-widest"
          >
            Powered by Kretopia
          </a>
        </div>
      </footer>

      {/* Inquiry Dialog */}
      <CustomProjectRequestDialog
        open={showInquiry}
        onOpenChange={setShowInquiry}
        creatorId={profile.user_id}
        creatorName={profile.full_name}
      />
    </div>
  );
};
