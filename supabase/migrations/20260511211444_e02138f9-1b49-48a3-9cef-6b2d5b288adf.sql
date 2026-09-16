
-- One-time codes for linking Telegram chat -> user
CREATE TABLE public.telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_link_tokens_user ON public.telegram_link_tokens(user_id);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own link tokens"
  ON public.telegram_link_tokens FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users create own link tokens"
  ON public.telegram_link_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Linked external messaging channels (telegram, whatsapp, ...)
CREATE TABLE public.messaging_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('telegram','whatsapp')),
  external_chat_id text NOT NULL,
  external_username text,
  external_display_name text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (channel, external_chat_id)
);
CREATE INDEX idx_messaging_channels_user ON public.messaging_channels(user_id);

ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own channels"
  ON public.messaging_channels FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users delete own channels"
  ON public.messaging_channels FOR DELETE
  USING (auth.uid() = user_id);
-- INSERT/UPDATE only via service role (webhook).

-- Idempotent inbound update log
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  telegram_user_id bigint,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text,
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_messages_chat ON public.telegram_messages(chat_id);
CREATE INDEX idx_telegram_messages_user ON public.telegram_messages(user_id);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
-- No public policies: service-role only.
