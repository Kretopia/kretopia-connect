-- Update portfolio bucket to support more audio/video formats and increase file size limit to 100MB
UPDATE storage.buckets 
SET 
  file_size_limit = 104857600, -- 100MB for larger audio/video files
  allowed_mime_types = ARRAY[
    -- Images
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    -- Videos
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/mpeg',
    -- Audio (comprehensive for music producers)
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 
    'audio/aac', 'audio/x-aac', 'audio/mp4', 'audio/x-m4a', 'audio/flac',
    'audio/x-flac', 'audio/aiff', 'audio/x-aiff', 'audio/webm',
    -- Documents
    'application/pdf'
  ]
WHERE name = 'portfolio';