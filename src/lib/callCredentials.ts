import { supabase } from "@/integrations/supabase/client";
import { extractInvokeError } from "@/lib/extractInvokeError";

/**
 * What a join link has to give before the call can start: the room, the person's own Daily token, and what to call the call. The pages for
 * `/meet/:id` and `/call/:token` only obtain this; the call itself is the one the app shell owns (VideoCallSheet), the same as for a Studio
 * or a Messages call. Both functions throw an Error whose message can be shown to the person as it is.
 */
export interface CallCredentials {
  roomUrl: string;
  token: string;
  title: string;
  /** Only a meeting's host (the token's owner) gets the host controls. */
  isHost: boolean;
}

/** A meeting's token for a signed-in member, or for a guest with the link's share token. A guest's name goes into the token, which Daily then shows as the display name. */
export async function mintMeetingCredentials(meetingId: string, shareToken: string | undefined, userName: string | undefined): Promise<CallCredentials> {
  try {
    const { data, error } = await supabase.functions.invoke("mint-meeting-token", {
      body: { meeting_id: meetingId, share_token: shareToken, user_name: userName || undefined },
    });
    if (error || !data?.token || !data?.room_url) {
      throw new Error(data?.error || (await extractInvokeError(error)) || "Couldn't load meeting");
    }
    return { token: data.token, roomUrl: data.room_url, title: data.title || "Meeting", isHost: data.role === "host" };
  } catch (e) {
    throw new Error((e instanceof Error && e.message) || (await extractInvokeError(e)) || "Couldn't load meeting");
  }
}

/** A guest link's token, minted for the name the guest gave. */
export async function redeemGuestLink(linkToken: string, guestName: string): Promise<CallCredentials> {
  try {
    const { data, error } = await supabase.functions.invoke("redeem-video-guest-link", { body: { token: linkToken, guest_name: guestName.trim() } });
    if (error) throw error;
    if (!data?.room_url || !data?.token) throw new Error(data?.error || "Invalid response");
    return { token: data.token, roomUrl: data.room_url, title: "Live call", isHost: false };
  } catch (e) {
    throw new Error((await extractInvokeError(e)) || (e instanceof Error && e.message) || "Couldn't join the call");
  }
}
