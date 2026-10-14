/**
 * The columns of `user_email_settings` a screen may load.
 *
 * `gmail_app_password` is deliberately absent: the UI only ever sends it to
 * `send-outreach-email` (connect) and never reads it back. A `select("*")` put
 * the stored password into the browser's query cache on every visit, where any
 * script on the page could read it. Keep this list explicit; do not add the
 * credential column.
 */
export const EMAIL_SETTINGS_COLUMNS =
  "id, user_id, provider, gmail_email, is_configured, last_tested_at, created_at, updated_at";
