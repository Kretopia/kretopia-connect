DO $$
DECLARE
  v_user uuid := 'b384f1ee-3e45-4584-bf4f-842d87c3a6e1';
  v_email text := 'sarah@viralreelscreator.com';
BEGIN
  DELETE FROM public.email_send_log WHERE recipient_email = v_email;
  DELETE FROM public.email_unsubscribe_tokens WHERE email = v_email;
  DELETE FROM public.suppressed_emails WHERE email = v_email;
  DELETE FROM public.profiles WHERE user_id = v_user;
  DELETE FROM auth.users WHERE id = v_user;
END $$;