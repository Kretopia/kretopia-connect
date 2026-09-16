import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { limit = 25, only_missing_bio = false, scrape_website = true } = await req.json().catch(() => ({}));

    console.log(`[batch-enrich] Starting batch enrichment, limit: ${limit}`);

    // Find profiles that need enrichment: missing bio, skills, or have credits but incomplete profiles
    let query = supabase
      .from('profiles')
      .select('user_id, full_name, bio, professional_skills, job_title, industry, role')
      .not('full_name', 'is', null)
      .neq('full_name', '')
      .neq('full_name', 'New User')
      .limit(limit);

    if (only_missing_bio) {
      query = query.or('bio.is.null,bio.eq.');
    } else {
      // Get profiles missing bio OR skills OR job_title — we'll also check for missing credits below
      query = query.or('bio.is.null,bio.eq.,professional_skills.is.null,job_title.is.null');
    }

    const { data: profiles, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    // Also find profiles with no credits at all — they need credit discovery
    const profileUserIds = new Set((profiles || []).map((p: any) => p.user_id));
    const { data: allProfs } = await supabase
      .from('profiles')
      .select('user_id, full_name, bio, professional_skills, job_title, industry, role')
      .not('full_name', 'is', null)
      .neq('full_name', '')
      .neq('full_name', 'New User')
      .limit(100);

    for (const p of (allProfs || [])) {
      if (profileUserIds.has(p.user_id)) continue;
      // Check if this user has any credits
      const { count } = await supabase.from('credits').select('id', { count: 'exact', head: true }).eq('user_id', p.user_id);
      if ((count || 0) === 0) {
        profiles?.push(p);
        profileUserIds.add(p.user_id);
        if ((profiles?.length || 0) >= limit) break;
      }
    }

    console.log(`[batch-enrich] Found ${profiles?.length || 0} profiles to enrich (incl. missing credits)`);

    const results = {
      total: profiles?.length || 0,
      enriched: 0,
      errors: 0,
      details: [] as { user_id: string; name: string; result: any }[],
    };

    // Process profiles sequentially to avoid rate limits
    for (const profile of profiles || []) {
      try {
        console.log(`[batch-enrich] Enriching: ${profile.full_name}`);

        const enrichRes = await fetch(`${supabaseUrl}/functions/v1/enrich-creator-profile`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: profile.user_id,
            scrape_website,
          }),
        });

        const enrichData = await enrichRes.json();

        if (enrichRes.ok && enrichData.success) {
          results.enriched++;
          results.details.push({
            user_id: profile.user_id,
            name: profile.full_name,
            result: enrichData,
          });
          console.log(`[batch-enrich] ✓ ${profile.full_name}:`, enrichData);
        } else {
          results.errors++;
          console.error(`[batch-enrich] ✗ ${profile.full_name}:`, enrichData);
        }

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error(`[batch-enrich] Error for ${profile.full_name}:`, e);
        results.errors++;
      }
    }

    console.log(`[batch-enrich] Complete:`, { enriched: results.enriched, errors: results.errors });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[batch-enrich] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
