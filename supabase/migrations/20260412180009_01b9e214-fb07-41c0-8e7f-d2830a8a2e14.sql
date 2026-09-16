ALTER TABLE credits DISABLE TRIGGER auto_post_on_credit;

INSERT INTO credits (user_id, project_name, role, year, credit_category, platform, source, verification_status, description, url) VALUES
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Peru (feat. Ed Sheeran)', 'Producer', 2021, 'Music', 'Spotify', 'platform_import', 'verified', 'Produced Fireboy DML''s hit single featuring Ed Sheeran. Certified Platinum in UK and USA.', 'https://open.spotify.com/artist/1247AZNYLxb33DmPibFLZZ'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Show You the Money (Remix)', 'Producer', 2015, 'Music', 'Spotify', 'platform_import', 'verified', 'Remix production with over 2.2M streams on Spotify.', 'https://open.spotify.com/track/3hTLw115ohhFJWmiusvKGU'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Won Le Ba', 'Producer', 2020, 'Music', 'Spotify', 'platform_import', 'verified', 'Single with over 2.4M streams on Spotify.', 'https://open.spotify.com/track/2HTCCqELtpfYjTJvgKh49J'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Famous', 'Producer', 2024, 'Music', 'Spotify', 'platform_import', 'verified', 'Latest release single.', 'https://open.spotify.com/track/5lnVBqFqrRnIC3GjlVtcsF'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Aye Kan', 'Producer', 2019, 'Music', 'Spotify', 'platform_import', 'verified', 'Single with over 800K streams on Spotify.', 'https://open.spotify.com/track/3D18AObOl5tDhSMDNJOWpz'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'All Over You', 'Producer', 2019, 'Music', 'Spotify', 'platform_import', 'verified', 'Single with over 250K streams.', 'https://open.spotify.com/track/1Np4fgIzgU6pAzyaCMoKAF'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Maria (feat. Jay Moore & L.A.X)', 'Producer', 2017, 'Music', 'Spotify', 'platform_import', 'verified', 'Collaboration single.', 'https://open.spotify.com/album/3jm54wEcBPUn9ElOj1IzSR'),
('40b05cc3-34e4-4b74-94e6-3932a5b20d9a', 'Majesty', 'Producer', 2021, 'Music', 'Spotify', 'platform_import', 'verified', 'Single release.', 'https://open.spotify.com/album/5r4J0ZmH7FI1Y6LB72s6Ox');

ALTER TABLE credits ENABLE TRIGGER auto_post_on_credit;