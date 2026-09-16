-- Remove sample partner discounts
DELETE FROM partner_discounts 
WHERE partner_name IN ('WeWork', 'Adobe Creative Cloud', 'Skillshare', 'Canva Pro', 'FitBit Premium');