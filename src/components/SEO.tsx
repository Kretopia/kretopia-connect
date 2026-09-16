import { Helmet } from 'react-helmet-async';
import { getShareUrl } from '@/lib/constants';

interface SEOProps {
  title?: string;
  description?: string;
  type?: string;
  image?: string;
  url?: string;
  // For profile pages - JSON-LD Person schema
  profile?: {
    name: string;
    role?: string;
    location?: string;
    avatar?: string;
    bio?: string;
    skills?: string[];
    socialLinks?: {
      instagram?: string;
      twitter?: string;
      linkedin?: string;
      youtube?: string;
      website?: string;
    };
  };
}

export const SEO = ({
  title = "Kretopia — Where Creativity Lives. Passport · Scout · Kreto.",
  description = "Kretopia is the Creative Economy OS. Build your Creative Passport, claim verified credits, find opportunities with Scout, and act with Kreto — your Executive Producer.",
  type = "website",
  image = "https://www.kretopia.com/og-image.png",
  url,
  profile
}: SEOProps) => {
  // Generate JSON-LD structured data for profiles
  const generatePersonSchema = () => {
    if (!profile) return null;
    
    const schema: any = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": profile.name,
      "url": url || getShareUrl(),
    };

    if (profile.role) {
      schema.jobTitle = profile.role;
    }
    if (profile.bio) {
      schema.description = profile.bio;
    }
    if (profile.avatar) {
      schema.image = profile.avatar;
    }
    if (profile.location) {
      schema.address = {
        "@type": "PostalAddress",
        "addressLocality": profile.location
      };
    }
    if (profile.skills && profile.skills.length > 0) {
      schema.knowsAbout = profile.skills;
    }
    
    // Social links
    const sameAs: string[] = [];
    if (profile.socialLinks?.instagram) sameAs.push(profile.socialLinks.instagram);
    if (profile.socialLinks?.twitter) sameAs.push(profile.socialLinks.twitter);
    if (profile.socialLinks?.linkedin) sameAs.push(profile.socialLinks.linkedin);
    if (profile.socialLinks?.youtube) sameAs.push(profile.socialLinks.youtube);
    if (profile.socialLinks?.website) sameAs.push(profile.socialLinks.website);
    
    if (sameAs.length > 0) {
      schema.sameAs = sameAs;
    }

    return schema;
  };

  const personSchema = generatePersonSchema();

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      
      {/* Allow indexing for public pages */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type === 'profile' ? 'profile' : type} />
      <meta property="og:url" content={url || getShareUrl()} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Kretopia" />
      
      {/* Profile-specific OG tags */}
      {profile && (
        <>
          <meta property="profile:first_name" content={profile.name.split(' ')[0]} />
          {profile.name.split(' ').length > 1 && (
            <meta property="profile:last_name" content={profile.name.split(' ').slice(1).join(' ')} />
          )}
        </>
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@kretopia" />
      <meta name="twitter:url" content={url || getShareUrl()} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Canonical URL */}
      {url && <link rel="canonical" href={url} />}

      {/* JSON-LD Structured Data for Profiles */}
      {personSchema && (
        <script type="application/ld+json">
          {JSON.stringify(personSchema)}
        </script>
      )}
    </Helmet>
  );
};
