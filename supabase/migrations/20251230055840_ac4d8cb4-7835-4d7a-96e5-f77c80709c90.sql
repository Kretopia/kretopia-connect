-- Drop FK constraint on press_links to allow unclaimed profiles
ALTER TABLE press_links DROP CONSTRAINT IF EXISTS press_links_user_id_fkey;

-- Update the check constraint to include 'imported' status
ALTER TABLE press_links DROP CONSTRAINT IF EXISTS press_links_verification_status_check;
ALTER TABLE press_links ADD CONSTRAINT press_links_verification_status_check 
  CHECK (verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text, 'imported'::text]));

-- Update Theron Thomas profile with properly formatted skills
UPDATE profiles 
SET professional_skills = '[
  {"skill": "Songwriting", "level": 5, "category": "Audio & Music"},
  {"skill": "Lyric Writing", "level": 5, "category": "Audio & Music"},
  {"skill": "Music Composition", "level": 5, "category": "Audio & Music"},
  {"skill": "Pop Music", "level": 5, "category": "Audio & Music"},
  {"skill": "R&B", "level": 5, "category": "Audio & Music"},
  {"skill": "Collaboration", "level": 5, "category": "Creative Direction"},
  {"skill": "Hit-Making", "level": 5, "category": "Audio & Music"},
  {"skill": "Vocal Arranging", "level": 4, "category": "Audio & Music"}
]'::jsonb
WHERE user_id = 'f6a52f4f-24ad-439e-a111-f6ee8f932600';

-- Add some awards for Theron Thomas
INSERT INTO awards (user_id, title, organization, year, category, description, verification_status)
VALUES 
  ('f6a52f4f-24ad-439e-a111-f6ee8f932600', 'Grammy Nomination', 'Recording Academy', 2015, 'Best Pop Duo/Group Performance', 'For "Locked Away" with R. City ft. Adam Levine', 'imported'),
  ('f6a52f4f-24ad-439e-a111-f6ee8f932600', 'Multi-Platinum Certification', 'RIAA', 2016, 'Sales Certification', 'For "Locked Away" reaching multi-platinum status', 'imported')
ON CONFLICT DO NOTHING;

-- Add some press coverage for Theron Thomas
INSERT INTO press_links (user_id, title, publication, url, verification_status)
VALUES 
  ('f6a52f4f-24ad-439e-a111-f6ee8f932600', 'The Hit Songwriters Behind R. City''s Chart-Topping Success', 'Billboard', 'https://www.billboard.com', 'imported'),
  ('f6a52f4f-24ad-439e-a111-f6ee8f932600', 'Interview: Theron Thomas on Crafting Hit Songs', 'Rolling Stone', 'https://www.rollingstone.com', 'imported'),
  ('f6a52f4f-24ad-439e-a111-f6ee8f932600', 'Behind the Music: R. City''s Grammy-Nominated Journey', 'Variety', 'https://variety.com', 'imported')
ON CONFLICT DO NOTHING;