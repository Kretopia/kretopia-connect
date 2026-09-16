
CREATE TABLE public.saved_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  routing_number TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts" ON public.saved_bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bank accounts" ON public.saved_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank accounts" ON public.saved_bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank accounts" ON public.saved_bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_bank_accounts_updated_at
  BEFORE UPDATE ON public.saved_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
