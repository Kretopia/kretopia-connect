CREATE OR REPLACE FUNCTION public.set_task_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by = auth.uid();
  ELSIF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required';
  END IF;

  RETURN NEW;
END;
$function$;