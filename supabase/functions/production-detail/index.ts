import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { project_name, existing_roles } = await req.json();
    if (!project_name || typeof project_name !== 'string') {
      return new Response(JSON.stringify({ error: 'project_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch actual credit data from DB — this is our ONLY source of truth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: dbCredits } = await supabase
      .from('credits')
      .select('role, year, platform, location, client_brand, project_type, credit_category, url, primary_media_url, thumbnail_url, media_type, description, tags, user_id')
      .ilike('project_name', project_name);

    // Fetch real names for credited users
    const userIds = [...new Set((dbCredits || []).map(c => c.user_id).filter(Boolean))];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      profiles?.forEach(p => profileMap.set(p.user_id, p.full_name || 'Unknown'));
    }

    // Build factual credit entries with real names
    const creditEntries = (dbCredits || []).map(c => ({
      role: c.role,
      person_name: profileMap.get(c.user_id) || 'Unknown User',
      user_id: c.user_id,
    }));

    const dbYear = (dbCredits || []).find(c => c.year)?.year || null;
    const dbPlatform = (dbCredits || []).find(c => c.platform)?.platform || null;
    const dbLocation = (dbCredits || []).find(c => c.location)?.location || null;
    const dbClientBrand = (dbCredits || []).find(c => c.client_brand)?.client_brand || null;
    const dbProjectType = (dbCredits || []).find(c => c.project_type)?.project_type || null;
    const dbCategory = (dbCredits || []).find(c => c.credit_category)?.credit_category || null;
    const dbUrl = (dbCredits || []).find(c => c.url)?.url || null;
    const dbDescription = (dbCredits || []).find(c => c.description)?.description || null;

    // Collect all media URLs from credits
    const allMediaUrls = (dbCredits || [])
      .map(c => c.primary_media_url || c.url)
      .filter(Boolean);
    const dbMediaUrl = allMediaUrls[0] || null;
    const dbThumbnail = (dbCredits || []).find(c => c.thumbnail_url)?.thumbnail_url || null;

    // ═══════════════════════════════════════════════════
    // BUILD PRODUCTION DETAIL FROM DB FACTS ONLY — NO AI
    // ═══════════════════════════════════════════════════

    // Infer type from category/project_type
    const typeMap: Record<string, string> = {
      'music': 'Song', 'film': 'Film', 'tv': 'TV Show', 'music_video': 'Music Video',
      'commercial': 'Commercial', 'events': 'Event', 'theatre': 'Theatre',
      'podcast': 'Podcast', 'fashion': 'Fashion', 'photography': 'Photography',
      'design': 'Design', 'gaming': 'Game',
    };
    const inferredType = typeMap[dbCategory || ''] || typeMap[dbProjectType || ''] || 'Project';

    // Infer industry from category
    const industryMap: Record<string, string> = {
      'film': 'Film & TV', 'tv': 'Film & TV', 'music_video': 'Film & TV',
      'music': 'Music', 'commercial': 'Advertising', 'fashion': 'Fashion',
      'events': 'Events', 'theatre': 'Performing Arts', 'podcast': 'Media',
      'photography': 'Photography', 'design': 'Design', 'gaming': 'Gaming',
    };
    const inferredIndustry = industryMap[dbCategory || ''] || 'Creative Industries';

    // Group credited people by role into departments
    const departmentMap: Record<string, Array<{ role: string; name: string | null }>> = {};
    for (const entry of creditEntries) {
      // Simple department inference from role
      const role = entry.role || 'Unknown';
      let dept = 'Credited';
      const roleLower = role.toLowerCase();
      if (/director|producer|writer|screenplay/i.test(roleLower)) dept = 'Production';
      else if (/actor|actress|cast|performer/i.test(roleLower)) dept = 'Cast';
      else if (/camera|cinematograph|dp|gaffer|grip/i.test(roleLower)) dept = 'Camera & Lighting';
      else if (/editor|post|vfx|color/i.test(roleLower)) dept = 'Post-Production';
      else if (/sound|audio|mix|master|engineer/i.test(roleLower)) dept = 'Sound & Music';
      else if (/design|art|costume|makeup|hair|style/i.test(roleLower)) dept = 'Art & Design';
      else if (/music|composer|songwriter|vocal|sing|beat|produc/i.test(roleLower)) dept = 'Music';

      if (!departmentMap[dept]) departmentMap[dept] = [];
      departmentMap[dept].push({ role, name: entry.person_name });
    }

    const departments = Object.entries(departmentMap).map(([name, roles]) => ({ name, roles }));

    const production = {
      name: project_name,
      type: inferredType,
      year: dbYear,
      industry: inferredIndustry,
      description: dbDescription || null, // Only use DB description, never AI-generated
      platform: dbPlatform,
      location: dbLocation,
      client_brand: dbClientBrand,
      external_url: dbUrl,
      image_url: dbThumbnail,
      media_url: dbMediaUrl,
      departments,
      total_roles: creditEntries.length,
      source: 'Platform Database',
    };

    return new Response(JSON.stringify({ production }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Production detail error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
