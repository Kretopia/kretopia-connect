import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { SENDER_DOMAIN, FROM_DOMAIN } from '../_shared/emailSender.ts'
import { identifyCaller } from '../_shared/callerAuth.ts'
import { authorizeTransactionalSend, type EmailPolicyDeps } from '../_shared/transactionalEmailPolicy.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// SENDER_DOMAIN / FROM_DOMAIN live in _shared/emailSender.ts: they must belong together
// (the email API rejects a From domain that does not align with the sender domain) and each
// backend keeps its own copy of that one file.
const SITE_NAME = "Kretopia"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Auth note: verify_jwt only proves the bearer is *a* valid JWT, and the public anon key is one,
// so the gateway alone let anyone send any template to any address from our domain. The caller
// is now identified here (service role / signed-in member / anonymous) and every non-server
// request is authorised per template, see _shared/transactionalEmailPolicy.ts.

/** Database reads behind the policy. Fail-closed: a failed lookup reads as "not proven". */
// deno-lint-ignore no-explicit-any
function emailPolicyDeps(db: any): EmailPolicyDeps {
  const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
  return {
    async recentSendCount(recipientEmail, sinceMinutes) {
      const { count } = await db
        .from('email_send_log')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_email', recipientEmail)
        .in('status', ['pending', 'sent'])
        .gte('created_at', since(sinceMinutes))
      return count ?? 0
    },
    async eventFacts(eventId) {
      const { data } = await db
        .from('creative_jams')
        .select('id, title, start_time, venue_name, venue_address')
        .eq('id', eventId)
        .maybeSingle()
      return data ?? null
    },
    async participantRegistered(eventId, userId) {
      const { data } = await db
        .from('jam_participants')
        .select('id, status')
        .eq('jam_id', eventId)
        .eq('user_id', userId)
        .maybeSingle()
      return !!data && data.status !== 'cancelled'
    },
    async guestRsvpRecent(eventId, email, withinMinutes) {
      const { data } = await db
        .from('guest_rsvps')
        .select('id')
        .eq('event_id', eventId)
        .eq('guest_email', email.toLowerCase())
        .gte('updated_at', since(withinMinutes))
        .limit(1)
      return !!data?.length
    },
    async opportunityFacts(opportunityId) {
      const { data } = await db
        .from('opportunities')
        .select('created_by, title')
        .eq('id', opportunityId)
        .maybeSingle()
      return data ?? null
    },
    async applicationExists(opportunityId, applicantId) {
      const { data } = await db
        .from('applications')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .eq('applicant_id', applicantId)
        .limit(1)
      return !!data?.length
    },
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let recipientUserId: string | undefined
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    recipientUserId = body.recipientUserId || body.recipient_user_id
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Who is asking, and may they send this? Other edge functions (service role) pass through
  // unchanged; browsers are limited to the templates the app sends, each with proof.
  const caller = await identifyCaller(req, { serviceRoleKey: supabaseServiceKey, admin: supabase })
  const decision = await authorizeTransactionalSend(
    caller,
    { templateName, recipientEmail, recipientUserId, templateData },
    emailPolicyDeps(supabase),
  )
  if (!decision.allow) {
    console.warn('Transactional email refused', { templateName, caller: caller.kind, status: decision.status, reason: decision.error })
    return new Response(
      JSON.stringify({ error: decision.error }),
      {
        status: decision.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
  templateData = decision.templateData

  // If recipientUserId is provided but no email, resolve email from auth.users
  if (recipientUserId && !recipientEmail) {
    const { data: authUser } = await supabase.auth.admin.getUserById(recipientUserId)
    if (authUser?.user?.email) {
      recipientEmail = authUser.user.email
    }
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text.
  // Templates may opt in to a visible one-click unsubscribe link by reading
  // `unsubscribeUrl`; it is set here, after caller data, so a caller can't
  // override it. Templates that don't read it are unaffected.
  const renderData = {
    ...templateData,
    unsubscribeUrl: `https://www.kretopia.com/unsubscribe?token=${unsubscribeToken}`,
  }
  const html = await renderAsync(
    React.createElement(template.component, renderData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, renderData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  // The queue only actually gets drained by a pg_cron job (process-email-queue,
  // every 5s) that lives outside version control -- it's created dynamically by
  // Lovable's email setup tool via the Management API, not by any migration
  // here, so it can silently be missing, misconfigured, or stalled with no
  // trace in this repo. Don't make every transactional email depend on that
  // cron alone: kick the dispatcher directly, right after enqueueing, so a
  // message sends within this same request's lifetime instead of waiting on
  // (or depending entirely on) an external job we have no visibility into.
  // Fire-and-forget -- EdgeRuntime.waitUntil keeps it alive past the response
  // without making the caller wait on a full queue-drain cycle.
  const kickQueue = fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  }).catch((err) => {
    console.warn('Failed to kick process-email-queue after enqueue', { error: String(err) })
  })
  try {
    // @ts-ignore Deno Deploy global, not in the standard Deno lib types
    EdgeRuntime?.waitUntil?.(kickQueue)
  } catch {
    // older runtimes without EdgeRuntime.waitUntil — the cron (if it's
    // running) still picks this message up on its next tick regardless
  }

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
