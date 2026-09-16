import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Kretopia's friendly feedback assistant. Your job is to help beta testers share their thoughts about the platform.

BEHAVIOR:
1. Greet users warmly and ask what's on their mind
2. Listen carefully and ask 1-2 clarifying follow-up questions to understand their feedback better
3. If they're reporting a bug, try to suggest a quick workaround if possible
4. Once you have enough context, thank them genuinely

CATEGORIZATION:
After each user message, you must include a hidden categorization tag at the END of your response in this exact format:
[FEEDBACK_DATA:{"category":"bug|feature|ui|general","summary":"one-line summary of the feedback","ready_to_save":true|false}]

- Set ready_to_save to true only when you've gathered enough detail (usually after 1-2 exchanges)
- Set it to false while still asking follow-up questions
- category should be: "bug" for issues/errors, "feature" for new ideas, "ui" for design/UX feedback, "general" for everything else

Keep responses concise (2-3 sentences max). Be enthusiastic but genuine. Use emoji sparingly.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    const user = userData.user;

    const { messages, pageUrl } = await req.json();

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const aiMessage = aiResult.choices?.[0]?.message?.content || "Thanks for your feedback!";

    // Parse feedback data from AI response
    const feedbackMatch = aiMessage.match(/\[FEEDBACK_DATA:(.*?)\]/);
    let feedbackData = null;
    let cleanMessage = aiMessage;

    if (feedbackMatch) {
      try {
        feedbackData = JSON.parse(feedbackMatch[1]);
        cleanMessage = aiMessage.replace(/\[FEEDBACK_DATA:.*?\]/, "").trim();
      } catch {
        console.error("Failed to parse feedback data");
      }
    }

    // Save feedback if ready
    let saved = false;
    if (feedbackData?.ready_to_save) {
      // Compile the full conversation as the feedback message
      const userMessages = messages
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content)
        .join("\n---\n");

      const { error: insertError } = await supabaseClient.from("feedback").insert({
        user_id: user.id,
        category: feedbackData.category || "general",
        message: `[AI Summary] ${feedbackData.summary}\n\n[Full conversation]\n${userMessages}`,
        page_url: pageUrl || null,
      });

      if (insertError) {
        console.error("Failed to save feedback:", insertError);
      } else {
        saved = true;
      }
    }

    return new Response(JSON.stringify({
      message: cleanMessage,
      saved,
      category: feedbackData?.category,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("feedback-chat error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
