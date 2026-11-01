import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { GEMINI_FLASH } from "../_shared/aiModels.ts";


import { corsFor, safeError } from '../_shared/guard.ts';
import { requireAiCaller } from '../_shared/aiPerimeter.ts';
import { FetchPolicyError, safeFetchBytes } from "../_shared/ssrf.ts";
import {
  VOICE_NOTE_MAX_BYTES,
  VOICE_NOTE_MIME,
  VOICE_NOTE_TRANSCRIPT_MAX_CHARS,
  decideVoiceNote,
  isOwnStorageUrl,
  storageHosts,
  toBase64,
  voiceSelect,
  voiceTableFor,
} from "../_shared/voiceNote.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every refusal happens before the audio is fetched and before the model is called (_shared/voiceNote.ts has the rules). The
// `audio_url` the callers still send is ignored on purpose: the file is the one the stored message points to.
Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const caller = await requireAiCaller(req, "transcribe-voice-note");
    const body = await req.json().catch(() => ({}));
    const message_id = body?.message_id;

    if (typeof message_id !== "string" || !UUID_RE.test(message_id)) {
      return reply({ error: "message_id required" }, 400);
    }

    // Whitelist of the tables a transcript can be written back to.
    const spec = voiceTableFor(body?.table);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: rowError } = await supabase.from(spec.table).select(voiceSelect(spec)).eq("id", message_id).maybeSingle();
    if (rowError) return reply({ error: "Could not load the message, try again shortly" }, 503);
    const decision = decideVoiceNote(spec, row as Record<string, unknown> | null, caller.id);
    if (!decision.ok) return reply({ error: decision.error }, decision.status);

    // Already transcribed (a silent note is "" and counts): nothing is fetched or billed again.
    if (decision.transcript !== null) return reply({ success: true, transcript: decision.transcript, already: true });

    const hosts = storageHosts(Deno.env.get("SUPABASE_URL"), Deno.env.get("LEGACY_SUPABASE_URL"));
    if (!isOwnStorageUrl(decision.url, hosts)) {
      return reply({ error: "This voice note is not stored with us and cannot be transcribed" }, 422);
    }

    // Download the audio from our storage, under a type and size cap, without following a redirect anywhere else.
    let bytes: Uint8Array;
    try {
      const file = await safeFetchBytes(decision.url, {
        allowedHosts: hosts,
        allowedMime: [...VOICE_NOTE_MIME],
        maxBytes: VOICE_NOTE_MAX_BYTES,
        maxRedirects: 0,
        timeoutMs: 15_000,
      });
      if (file.status < 200 || file.status >= 300) return reply({ error: "The voice note could not be read" }, 502);
      bytes = file.bytes;
    } catch (e) {
      if (e instanceof FetchPolicyError) return reply({ error: e.code === "too_large" ? "This voice note is too large to transcribe" : "The voice note could not be read" }, e.code === "too_large" ? 413 : 422);
      throw e;
    }
    const base64Audio = toBase64(bytes);

    // Send to Gemini for transcription
    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_FLASH,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcribe this voice note exactly. Return only the transcription text, no preamble or commentary. If the audio is silent or unintelligible, return an empty string.",
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: "webm",
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) return reply({ error: "Rate limit exceeded" }, 429);
      if (aiResp.status === 402) return reply({ error: "Payment required" }, 402);
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const transcript: string = String(aiData.choices?.[0]?.message?.content ?? "").trim().slice(0, VOICE_NOTE_TRANSCRIPT_MAX_CHARS);

    // Write it once: only while the message still has no transcript, so two requests cannot overwrite each other.
    const { error: updateError } = await supabase
      .from(spec.table)
      .update({ [spec.transcript]: transcript })
      .eq("id", message_id)
      .is(spec.transcript, null);

    if (updateError) {
      console.error("Failed to update message:", updateError);
      throw updateError;
    }

    return reply({ success: true, transcript });
  } catch (e) {
    console.error("transcribe-voice-note error:", e);
    return safeError(e, req);
  }
});
