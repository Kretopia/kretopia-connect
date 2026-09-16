
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler) VALUES
-- gig
('search_scouted_gigs', 'gig', 'Search the open web (LinkedIn, IG, ATS boards) for fresh creative gigs matching the user''s preferences. Returns scouted_gigs rows.', 'safe_auto',
 '{"type":"object","properties":{"query":{"type":"string","description":"Optional override search query"},"limit":{"type":"number"}},"additionalProperties":true}'::jsonb,
 'scout-gigs'),
('draft_gig_application', 'gig', 'Draft a personalized cover letter / application for a specific gig (scouted or marketplace). Returns text the user can review.', 'safe_auto',
 '{"type":"object","properties":{"gig_id":{"type":"string"},"scouted_gig_id":{"type":"string"},"tone":{"type":"string"}},"additionalProperties":true}'::jsonb,
 'draft-gig-application'),
-- event
('rsvp_to_event', 'event', 'RSVP the current user to an event by event_id. Use after the user says "save my spot" / "I''m going".', 'requires_approval',
 '{"type":"object","properties":{"event_id":{"type":"string"},"referred_by":{"type":["string","null"]},"referral_channel":{"type":"string"}},"required":["event_id"],"additionalProperties":false}'::jsonb,
 'agent-rsvp-event'),
('send_event_invite', 'event', 'Send invites for an event the user owns to one or more recipients (emails or user_ids).', 'requires_approval',
 '{"type":"object","properties":{"event_id":{"type":"string"},"recipients":{"type":"array","items":{"type":"string"}},"message":{"type":["string","null"]}},"required":["event_id","recipients"],"additionalProperties":true}'::jsonb,
 'send-event-invite'),
('generate_event_cover', 'event', 'Generate an AI cover image for an event from a short prompt. Returns image URL.', 'safe_auto',
 '{"type":"object","properties":{"prompt":{"type":"string"}},"required":["prompt"],"additionalProperties":false}'::jsonb,
 'generate-event-cover'),
('match_event_guests', 'event', 'Find best-fit creators on the platform to invite to an event the user owns.', 'safe_auto',
 '{"type":"object","properties":{"event_id":{"type":"string"},"limit":{"type":"number"}},"required":["event_id"],"additionalProperties":true}'::jsonb,
 'match-event-guests'),
-- profile
('enrich_profile', 'profile', 'Run background enrichment on the current user''s profile (links, credits, press). Safe to run anytime.', 'safe_auto',
 '{"type":"object","properties":{"user_id":{"type":["string","null"]}},"additionalProperties":true}'::jsonb,
 'enrich-creator-profile'),
('analyze_profile_url', 'profile', 'Analyze a public URL (LinkedIn, IMDB, personal site) and extract structured profile data.', 'safe_auto',
 '{"type":"object","properties":{"url":{"type":"string"}},"required":["url"],"additionalProperties":true}'::jsonb,
 'analyze-profile-url'),
-- money_admin
('scan_receipt', 'money_admin', 'Extract vendor, amount, date, category and line items from a receipt/bill image (base64 or URL).', 'safe_auto',
 '{"type":"object","properties":{"image_url":{"type":["string","null"]},"image_base64":{"type":["string","null"]}},"additionalProperties":true}'::jsonb,
 'scan-receipt'),
-- credit (vouch)
('vouch_credit', 'credit', 'Vouch for someone on a specific credit. Acts as a public endorsement.', 'requires_approval',
 '{"type":"object","properties":{"credit_id":{"type":"string"},"action":{"type":"string","enum":["vouch","unvouch"]},"note":{"type":["string","null"]}},"required":["credit_id"],"additionalProperties":false}'::jsonb,
 'agent-vouch-credit')
ON CONFLICT (tool_name) DO UPDATE SET
  agent_kind = EXCLUDED.agent_kind,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  args_schema = EXCLUDED.args_schema,
  handler = EXCLUDED.handler;
