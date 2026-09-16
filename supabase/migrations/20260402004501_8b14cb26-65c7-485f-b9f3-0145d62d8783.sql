
-- Location categories taxonomy for Creative Atlas
CREATE TABLE public.location_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  parent_slug TEXT REFERENCES public.location_categories(slug),
  location_type TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow everyone to read categories (public reference data)
ALTER TABLE public.location_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.location_categories FOR SELECT USING (true);

-- Seed: Top-level location types
INSERT INTO public.location_categories (slug, name, emoji, description, location_type, display_order) VALUES
-- STUDIOS
('recording-studio', 'Recording Studio', '🎙️', 'Music recording, mixing, mastering', 'studio', 1),
('photo-studio', 'Photo Studio', '📸', 'Professional photography studio with lighting', 'studio', 2),
('video-studio', 'Video Studio', '🎬', 'Film, video production, green screen', 'studio', 3),
('podcast-studio', 'Podcast Studio', '🎧', 'Podcast recording and production', 'studio', 4),
('dance-studio', 'Dance Studio', '💃', 'Dance rehearsal and performance space', 'studio', 5),
('rehearsal-studio', 'Rehearsal Space', '🥁', 'Band rehearsal, jam rooms', 'studio', 6),
('animation-studio', 'Animation Studio', '✏️', 'Animation, motion graphics workspace', 'studio', 7),

-- CREATIVE SPACES
('coworking', 'Creative Coworking', '💻', 'Shared workspace for creatives', 'creative_space', 10),
('maker-space', 'Maker Space', '🔧', 'Tools, 3D printers, CNC, laser cutters', 'creative_space', 11),
('art-workshop', 'Art Workshop', '🖌️', 'Painting, sculpting, ceramics studio', 'creative_space', 12),
('fashion-atelier', 'Fashion Atelier', '✂️', 'Sewing, pattern-making, fashion design', 'creative_space', 13),
('darkroom', 'Darkroom', '🔴', 'Film development, analog printing', 'creative_space', 14),
('screen-print-shop', 'Screen Print Shop', '🖨️', 'Screen printing, merch production', 'creative_space', 15),

-- SHOOT SPOTS
('mural-wall', 'Mural Wall', '🎨', 'Street art, graffiti, colorful backdrops', 'shoot_spot', 20),
('rooftop', 'Rooftop', '🏙️', 'City skyline views, golden hour spots', 'shoot_spot', 21),
('abandoned-aesthetic', 'Urban Ruins', '🏚️', 'Abandoned buildings, industrial aesthetic', 'shoot_spot', 22),
('nature-spot', 'Nature Spot', '🌿', 'Parks, gardens, waterfalls, scenic trails', 'shoot_spot', 23),
('architectural', 'Architectural', '🏛️', 'Unique architecture, staircases, columns', 'shoot_spot', 24),
('neon-lights', 'Neon & Lights', '🔮', 'Neon signs, light installations, night spots', 'shoot_spot', 25),
('beach-waterfront', 'Beach & Waterfront', '🏖️', 'Coastal, pier, harbour, waterfront views', 'shoot_spot', 26),
('cultural-heritage', 'Cultural Heritage', '🕌', 'Historic buildings, temples, landmarks', 'shoot_spot', 27),

-- VENUES
('gallery', 'Art Gallery', '🖼️', 'Exhibition space, art shows', 'venue', 30),
('performance-venue', 'Performance Venue', '🎤', 'Live music, comedy, spoken word', 'venue', 31),
('event-space', 'Event Space', '🎉', 'Pop-ups, launches, networking events', 'venue', 32),
('cinema-screening', 'Cinema / Screening Room', '🎞️', 'Film screenings, premieres', 'venue', 33),
('outdoor-venue', 'Outdoor Venue', '⛺', 'Amphitheaters, festival grounds, gardens', 'venue', 34),

-- MUSIC STORES
('instrument-shop', 'Instrument Shop', '🎸', 'Guitars, keyboards, drums, strings', 'music_store', 40),
('vinyl-records', 'Vinyl / Record Shop', '💿', 'Vinyl, CDs, crates, rare finds', 'music_store', 41),
('pro-audio-gear', 'Pro Audio Gear', '🔊', 'Microphones, interfaces, monitors, cables', 'music_store', 42),
('dj-equipment', 'DJ Equipment', '🎛️', 'Turntables, controllers, mixers', 'music_store', 43),

-- ART SUPPLY
('art-materials', 'Art Materials', '🎨', 'Paints, brushes, canvases, sketchbooks', 'art_supply', 50),
('craft-supply', 'Craft Supply', '🧶', 'Fabrics, beads, yarn, craft tools', 'art_supply', 51),
('stationery-design', 'Design Stationery', '📐', 'Markers, pens, paper, design tools', 'art_supply', 52),
('framing-shop', 'Framing Shop', '🖼️', 'Custom framing, mounting, matting', 'art_supply', 53),

-- RENTAL HOUSES
('camera-rental', 'Camera Rental', '📷', 'DSLR, mirrorless, cinema cameras', 'rental_house', 60),
('lighting-rental', 'Lighting Rental', '💡', 'Studio lights, gels, modifiers', 'rental_house', 61),
('audio-rental', 'Audio Rental', '🎤', 'Microphones, PA systems, monitors', 'rental_house', 62),
('prop-rental', 'Prop Rental', '🪑', 'Furniture, set pieces, costumes', 'rental_house', 63),
('drone-rental', 'Drone Rental', '🚁', 'Aerial photography and videography drones', 'rental_house', 64),

-- PHOTO LABS
('film-processing', 'Film Processing', '🎞️', 'C-41, E-6, B&W film development', 'photo_lab', 70),
('fine-art-printing', 'Fine Art Printing', '🖨️', 'Giclée, large format, archival prints', 'photo_lab', 71),
('photo-scanning', 'Photo Scanning', '🔍', 'Negative scanning, digitization', 'photo_lab', 72),
('photo-restoration', 'Photo Restoration', '✨', 'Retouching, color correction, repair', 'photo_lab', 73);
