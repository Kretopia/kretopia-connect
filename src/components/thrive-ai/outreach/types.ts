export type Lead = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  type: string;
};

export type Sequence = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  lead_id: string | null;
  recipient_email: string | null;
  total_steps: number;
  completed_steps: number;
  created_at: string;
};

export type SequenceEmail = {
  id: string;
  sequence_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  status: string;
  sent_at: string | null;
};

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-500",
  paused: "bg-yellow-500/10 text-yellow-500",
  completed: "bg-primary/10 text-primary",
};
