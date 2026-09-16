import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[Onboarding Reminders] Checking for incomplete onboarding...')

    // Find users who started 24h+ ago, haven't completed, and haven't been reminded
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: incompleteProfiles, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('user_id, full_name, onboarding_step, onboarding_started_at')
      .eq('onboarding_completed', false)
      .eq('onboarding_reminder_sent', false)
      .lt('onboarding_started_at', twentyFourHoursAgo)
      .not('onboarding_started_at', 'is', null)

    if (fetchError) {
      console.error('[Onboarding Reminders] Query error:', fetchError)
      throw fetchError
    }

    console.log(`[Onboarding Reminders] Found ${incompleteProfiles?.length || 0} users to remind`)

    if (!incompleteProfiles || incompleteProfiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users to remind', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let successCount = 0
    let errorCount = 0

    for (const profile of incompleteProfiles) {
      try {
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(
          profile.user_id
        )

        if (userError || !userData.user?.email) {
          console.error(`[Onboarding Reminders] No email for ${profile.user_id}`)
          errorCount++
          continue
        }

        const firstName = profile.full_name?.split(' ')[0] || undefined

        // Create in-app notification
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: profile.user_id,
            title: '🚀 Complete Your ThriveIN Profile',
            message: 'You\'re almost there — finish setting up to start connecting with creators.',
            type: 'reminder',
            link: '/onboarding',
            action_url: '/onboarding',
            action_text: 'Complete Your Profile',
            priority: 'high',
            category: 'onboarding',
          })

        // Send email via transactional email system
        const { error: emailError } = await supabaseClient.functions.invoke(
          'send-transactional-email',
          {
            body: {
              templateName: 'onboarding-reminder',
              recipientEmail: userData.user.email,
              idempotencyKey: `onboarding-reminder-${profile.user_id}`,
              templateData: { name: firstName },
            },
          }
        )

        if (emailError) {
          console.error(`[Onboarding Reminders] Email error for ${userData.user.email}:`, emailError)
          errorCount++
          continue
        }

        // Mark reminder as sent
        await supabaseClient
          .from('profiles')
          .update({ onboarding_reminder_sent: true })
          .eq('user_id', profile.user_id)

        console.log(`[Onboarding Reminders] Sent to ${userData.user.email}`)
        successCount++
      } catch (error) {
        console.error(`[Onboarding Reminders] Error for ${profile.user_id}:`, error)
        errorCount++
      }
    }

    console.log(`[Onboarding Reminders] Done. Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ total: incompleteProfiles.length, success: successCount, errors: errorCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[Onboarding Reminders] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
