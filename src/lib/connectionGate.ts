/**
 * Connection Gate — hooks and utilities for tier-based messaging/connection gates.
 * 
 * Wraps the statusEngine gate logic with Supabase data fetching
 * so components can simply ask: "Can user A connect with user B?"
 */

import { supabase } from "@/integrations/supabase/client";
import { calculateStatusFromCredits, getConnectionGate, getGateMessage, type StatusTier, type ConnectionGate } from "@/lib/statusEngine";

export interface GateCheckResult {
  gate: ConnectionGate;
  message: string | null;
  senderTier: StatusTier;
  recipientTier: StatusTier;
}

/**
 * Fetches credits for a user and returns their calculated tier.
 */
async function getUserTier(userId: string): Promise<StatusTier> {
  const { data } = await supabase
    .from("credits")
    .select("verification_status")
    .eq("user_id", userId);
  
  const status = calculateStatusFromCredits(data || []);
  return status.tier;
}

/**
 * Check the connection gate between two users.
 * Returns the gate type and optional message for UI display.
 */
export async function checkConnectionGate(
  senderId: string,
  recipientId: string
): Promise<GateCheckResult> {
  const [senderTier, recipientTier] = await Promise.all([
    getUserTier(senderId),
    getUserTier(recipientId),
  ]);

  return {
    gate: getConnectionGate(senderTier, recipientTier),
    message: getGateMessage(senderTier, recipientTier),
    senderTier,
    recipientTier,
  };
}
