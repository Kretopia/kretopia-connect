
CREATE OR REPLACE FUNCTION public.auto_create_activity_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  activity_message text;
  post_category text;
  source text;
  post_link_url text;
  post_link_title text;
BEGIN
  IF TG_TABLE_NAME = 'credits' THEN
    activity_message := '🎬 Just wrapped ' || NEW.project_name || ' as ' || NEW.role || ' — show them some 🔥!';
    post_category := 'credit';
    source := 'credit';
    post_link_url := NEW.url;
    post_link_title := NEW.project_name;
  ELSIF TG_TABLE_NAME = 'awards' THEN
    activity_message := '🏆 Won ' || NEW.title || ' from ' || NEW.organization || ' — congratulations are in order!';
    post_category := 'award';
    source := 'award';
    post_link_url := NEW.verification_url;
    post_link_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'portfolio_items' THEN
    activity_message := '✨ Added new work: ' || NEW.title || ' — check it out!';
    post_category := COALESCE(NEW.media_type, 'general');
    source := 'portfolio';
    post_link_url := NEW.media_url;
    post_link_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'press_links' THEN
    activity_message := '📰 Featured: ' || NEW.title || COALESCE(' in ' || NEW.publication, '') || ' — big news!';
    post_category := 'press';
    source := 'press';
    post_link_url := NEW.url;
    post_link_title := NEW.title;
  END IF;

  INSERT INTO feed_posts (user_id, content, post_type, category, auto_activity_message, source_type, source_id, link_url, link_title)
  VALUES (NEW.user_id, activity_message, 'activity', post_category, activity_message, source, NEW.id::text, post_link_url, post_link_title);
  
  RETURN NEW;
END;
$function$;
