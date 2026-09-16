import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrCron } from "../_shared/admin-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const _guard = await requireAdminOrCron(req);
    if (!_guard.ok) return _guard.response;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { projects, companyName, contactEmail, submittedBy } = await req.json();

    if (!Array.isArray(projects) || projects.length === 0 || !companyName || !submittedBy) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (projects.length > 50) {
      return new Response(JSON.stringify({ error: 'Maximum 50 projects per batch' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create bulk submission record
    const { data: submission, error: subErr } = await supabase
      .from('icdb_bulk_submissions')
      .insert({
        submitted_by: submittedBy,
        company_name: companyName,
        contact_email: contactEmail || '',
        projects_data: projects,
        total_count: projects.length,
      })
      .select()
      .single();

    if (subErr) throw subErr;

    // Process each project
    let processed = 0;
    const results: any[] = [];

    for (const proj of projects) {
      try {
        // Insert project
        const { data: newProject, error: projErr } = await supabase
          .from('icdb_projects')
          .insert({
            title: proj.title,
            type: proj.type || 'other',
            category: proj.category || null,
            year: proj.year || null,
            description: proj.description || null,
            platform: proj.platform || null,
            location: proj.location || null,
            client_brand: companyName,
            external_url: proj.url || null,
            is_verified: true, // Brand-submitted = verified
          })
          .select()
          .single();

        if (projErr) {
          results.push({ title: proj.title, status: 'error', error: projErr.message });
          continue;
        }

        // Insert roles
        if (Array.isArray(proj.roles)) {
          for (const role of proj.roles) {
            await supabase.from('icdb_project_roles').insert({
              project_id: newProject.id,
              role_title: role.role || role.title || 'Contributor',
              person_name: role.name || role.person || null,
              department: role.department || null,
            });
          }
        }

        processed++;
        results.push({ title: proj.title, status: 'created', id: newProject.id });
      } catch (e) {
        results.push({ title: proj.title, status: 'error', error: String(e) });
      }
    }

    // Update submission record
    await supabase
      .from('icdb_bulk_submissions')
      .update({ processed_count: processed, status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', submission.id);

    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      total: projects.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bulk submit error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
