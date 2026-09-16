// Industry Verified badge qualification logic
// Users qualify if they have 3+ verified credits OR 2+ awards

export interface IndustryBadgeStatus {
  qualifies: boolean;
  creditsCount: number;
  awardsCount: number;
  reason: string;
}

export function checkIndustryVerifiedStatus(
  creditsCount: number,
  awardsCount: number
): IndustryBadgeStatus {
  const qualifies = creditsCount >= 3 || awardsCount >= 2;
  
  let reason = '';
  if (qualifies) {
    if (creditsCount >= 3 && awardsCount >= 2) {
      reason = `${creditsCount} verified credits & ${awardsCount} awards`;
    } else if (creditsCount >= 3) {
      reason = `${creditsCount} verified credits`;
    } else {
      reason = `${awardsCount} industry awards`;
    }
  } else {
    const neededCredits = Math.max(0, 3 - creditsCount);
    const neededAwards = Math.max(0, 2 - awardsCount);
    reason = `Need ${neededCredits} more credits or ${neededAwards} more awards to qualify`;
  }
  
  return {
    qualifies,
    creditsCount,
    awardsCount,
    reason
  };
}
