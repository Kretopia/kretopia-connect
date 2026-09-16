-- Fix search_path for generate_invite_codes function
CREATE OR REPLACE FUNCTION public.generate_invite_codes(user_id_param uuid, num_codes integer DEFAULT 5)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  FOR i IN 1..num_codes LOOP
    INSERT INTO public.invites (inviter_id, invitee_email, status)
    VALUES (user_id_param, '', 'pending');
  END LOOP;
END;
$function$;