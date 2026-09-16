import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, token, roleId, projectId, brandEmail, brandName } = await req.json();

    if (action === 'request') {
      // Previously: no auth check, submittedBy was caller-supplied, and the
      // response leaked the verification_token directly — letting the same
      // caller immediately turn around and call action=verify themselves to
      // set their own credit's verification_status to 'enterprise' without
      // the brand ever seeing the email. Require a real caller, derive
      // submittedBy from their verified JWT, confirm they actually claimed
      // the role they're requesting verification for, and never return the
      // token — only the brand's inbox should ever see it.
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const submittedBy = user.id;

      if (!roleId || !projectId || !brandEmail || !brandName) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: roleRow } = await supabase
        .from('icdb_project_roles')
        .select('claimed_by')
        .eq('id', roleId)
        .maybeSingle();
      if (!roleRow || roleRow.claimed_by !== submittedBy) {
        return new Response(JSON.stringify({ error: 'Not authorized for this role' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.from('icdb_brand_verifications').insert({
        project_id: projectId,
        role_id: roleId,
        brand_name: brandName,
        brand_email: brandEmail,
        submitted_by: submittedBy,
      }).select('verification_token').single();

      if (error) throw error;

      // Get submitter profile for email personalization
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', submittedBy)
        .single();

      // Get project title
      const { data: project } = await supabase
        .from('icdb_projects')
        .select('title')
        .eq('id', projectId)
        .single();

      // Send verification email to brand
      const verifyUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.supabase.co').replace('https://', 'https://')}`;
      const siteUrl = Deno.env.get('SITE_URL') || 'https://thrivein-new-beta.lovable.app';
      const verificationLink = `${siteUrl}/verify-credit?token=${data.verification_token}`;

      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        const emailFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'Kretopia <info@kretopia.com>';
        const creatorName = profile?.full_name || 'A creator';
        const projectTitle = project?.title || 'a project';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [brandEmail],
            subject: `${creatorName} is requesting credit verification for "${projectTitle}"`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="margin-bottom: 8px;">Credit Verification Request</h2>
                <p style="color: #666; margin-bottom: 24px;">
                  <strong>${creatorName}</strong> has listed a credit on <strong>"${projectTitle}"</strong> and is requesting verification from <strong>${brandName}</strong>.
                </p>
                <p style="color: #666; margin-bottom: 24px;">
                  By clicking the button below, you confirm that this person was involved in this project.
                </p>
                <a href="${verificationLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Verify This Credit
                </a>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">
                  This link is unique and can only be used once. If you did not expect this email, you can safely ignore it.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 11px;">ThriveIN — The Professional Network for Creatives</p>
              </div>
            `,
          }),
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Verification request sent to ${brandEmail}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Token required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: verification, error: fetchErr } = await supabase
        .from('icdb_brand_verifications')
        .select('*, icdb_project_roles(id, claimed_by), icdb_projects(title)')
        .eq('verification_token', token)
        .eq('status', 'pending')
        .single();

      if (fetchErr || !verification) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark as verified
      await supabase.from('icdb_brand_verifications')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', verification.id);

      // Update the credit verification status to enterprise (100pts!)
      if (verification.role_id) {
        const { data: role } = await supabase
          .from('icdb_project_roles')
          .select('claimed_by')
          .eq('id', verification.role_id)
          .single();

        if (role?.claimed_by) {
          await supabase.from('credits')
            .update({ 
              verification_status: 'enterprise', 
              verified_by_name: verification.brand_name 
            })
            .eq('user_id', role.claimed_by)
            .ilike('project_name', `%${(verification as any).icdb_projects?.title || ''}%`);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        project: (verification as any).icdb_projects?.title,
        brand: verification.brand_name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Brand verification error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
