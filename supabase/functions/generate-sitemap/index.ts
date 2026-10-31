import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSitemapEligible, type ListingSeoInput } from "../_shared/discovery/seo.ts";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all public profiles (completed onboarding, has avatar and bio)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, updated_at')
      .eq('onboarding_completed', true)
      .not('avatar_url', 'is', null)
      .not('bio', 'is', null);

    if (error) {
      console.error('Error fetching profiles:', error);
      throw error;
    }

    const baseUrl = 'https://www.kretopia.com';
    const today = new Date().toISOString().split('T')[0];

    // Build sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/auth</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/community-guidelines</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
`;

    // Add public profile pages (EPK)
    for (const profile of profiles || []) {
      const lastmod = profile.updated_at 
        ? new Date(profile.updated_at).toISOString().split('T')[0]
        : today;
      
      sitemap += `  <url>
    <loc>${baseUrl}/epk/${profile.user_id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // Sourced listings: only published or claimed ones with enough permitted content, a real publisher and a destination,
    // and never an expired one (same rule as the page's robots tag). Skipped quietly before the migration exists.
    try {
      const { data: listings } = await supabase
        .from('public_external_listings')
        .select('id, kind, status, title, original_publisher, excerpt, description_full, apply_url, deadline_at, starts_at, last_checked_at')
        .limit(5000);
      for (const l of listings || []) {
        const input = { ...l, visibility: 'public', flagged_instructions: false, source_published_at: null, location: null, remote_scope: null, budget: null, applications_enabled: false, url: '' } as ListingSeoInput;
        if (!isSitemapEligible(input, new Date())) continue;
        const lastmod = l.last_checked_at ? new Date(l.last_checked_at).toISOString().split('T')[0] : today;
        sitemap += `  <url>
    <loc>${baseUrl}/listing/${l.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;
      }
    } catch (e) {
      console.warn('Sitemap: sourced listings skipped', e);
    }

    sitemap += `</urlset>`;

    console.log(`Generated sitemap with ${(profiles?.length || 0) + 5} URLs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate sitemap' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
