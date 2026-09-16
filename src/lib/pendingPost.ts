import { supabase } from "@/integrations/supabase/client";

export async function processPendingPost(userId: string): Promise<string | null> {
  try {
    const raw = sessionStorage.getItem("thrivein_pending_post");
    if (!raw) return null;
    sessionStorage.removeItem("thrivein_pending_post");

    const formData = JSON.parse(raw);

    if (formData.type === "gig") {
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          title: formData.title,
          description: formData.description || "",
          location: formData.location || null,
          type: formData.gigType || "Gig",
          category: formData.category || null,
          budget: formData.budget || null,
          created_by: userId,
          status: "active",
        })
        .select("id")
        .single();

      if (error) throw error;

      supabase.functions
        .invoke("generate-gig-cover", {
          body: {
            opportunityId: data.id,
            title: formData.title,
            category: formData.category,
            gigType: formData.gigType,
          },
        })
        .catch(() => {});

      return `/opportunity/${data.id}`;
    }

    const startTime = formData.eventDate || new Date(Date.now() + 7 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("creative_jams")
      .insert({
        title: formData.title,
        description: formData.description || null,
        venue_name: formData.location || null,
        start_time: startTime,
        created_by: userId,
        category: "general",
        ends_at: new Date(new Date(startTime).getTime() + 3 * 3600000).toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return `/event/${data.id}`;
  } catch (error) {
    console.warn("[pendingPost] Failed to process pending post:", error);
    return null;
  }
}
