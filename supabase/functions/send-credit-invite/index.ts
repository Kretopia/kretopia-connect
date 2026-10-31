import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { cleanFreeText, cleanRecipientEmail } from "../_shared/outboundText.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { corsFor } from '../_shared/guard.ts';
serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This had no authentication at all: inviter_id and credit_id were
    // fully caller-controlled, so anyone could impersonate any real user
    // in a mass "X credited you" email to arbitrary addresses, using that
    // user's real name looked up from their own profile. Require a real
    // caller and derive the inviter's identity from their verified JWT,
    // never from the request body -- and require they actually own the
    // credit they're claiming to invite people onto.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const inviter_id = user.id;

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { credit_id, project_name, role, external_collaborators } = await req.json();

    if (!credit_id || !external_collaborators?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the caller actually owns this credit before sending anything.
    const { data: creditRow } = await supabase
      .from('credits')
      .select('id, user_id')
      .eq('id', credit_id)
      .maybeSingle();
    if (!creditRow || creditRow.user_id !== inviter_id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this credit' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', inviter_id)
      .maybeSingle();

    const inviterName = inviterProfile?.full_name || 'A creative professional';
    const baseUrl = Deno.env.get('SITE_URL') || 'https://www.kretopia.com';

    const results = [];

    // At most 20 people per request, each one plain address; free text is
    // clipped before it goes into the mail template.
    const MAX_COLLABORATORS = 20;
    const collaborators = (Array.isArray(external_collaborators) ? external_collaborators : []).slice(0, MAX_COLLABORATORS);
    const projectNameClean = cleanFreeText(project_name, 120) ?? 'a project';
    const roleClean = cleanFreeText(role, 60);

    for (const collab of collaborators) {
      const email = cleanRecipientEmail(collab?.email);
      if (!email) {
        results.push({ email: null, name: null, error: 'invalid_email' });
        continue;
      }
      const name = cleanFreeText(collab?.name, 80) ?? 'there';

      // The invite must land on the one-tap confirmation page (/credit-verify),
      // which needs no account and is keyed by the endorsement's own token.
      // It used to point at /auth?claim=<new random token>, which the auth page
      // reads as a *profile* to claim, so invited collaborators hit a sign-up
      // wall and then a profile that doesn't exist, and could never confirm.
      // Reuse the token the request row already has; only mint one if it has none.
      const { data: existing } = await supabase
        .from('credit_endorsements')
        .select('token')
        .eq('credit_id', credit_id)
        .eq('endorser_email', email)
        .limit(1)
        .maybeSingle();
      let token: string | null = existing?.token ?? null;
      if (!token) {
        token = crypto.randomUUID();
        const { error: tokenErr } = await supabase.from('credit_endorsements').update({ token })
          .eq('credit_id', credit_id).eq('endorser_email', email);
        if (tokenErr) throw tokenErr;
      }

      const claimUrl = `${baseUrl}/credit-verify?token=${encodeURIComponent(token)}`;
      const whatsappText = encodeURIComponent(
        `Hey ${name}! ${inviterName} credited you on "${projectNameClean}" on Kretopia. Can you take 5 seconds to confirm you worked together? No account needed: ${claimUrl}`
      );
      const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

      let emailSent = false;
      try {
        const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'credit-chain-invite',
            recipientEmail: email,
            idempotencyKey: `credit-invite-${credit_id}-${email}`,
            templateData: {
              recipientName: name,
              inviterName,
              projectName: projectNameClean,
              role: roleClean || 'Collaborator',
              claimUrl,
              confirmUrl: claimUrl,
              whatsappUrl,
            },
          },
        });
        if (mailErr) console.log('Email send failed:', mailErr);
        else emailSent = true;
      } catch (emailErr) {
        // If transactional email system isn't set up, log but don't fail
        console.log('Email send skipped (system may not be configured):', emailErr);
      }

      results.push({ email, name, claim_url: claimUrl, whatsapp_url: whatsappUrl, email_sent: emailSent });
    }

    return new Response(JSON.stringify({ success: true, invites: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in send-credit-invite:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
