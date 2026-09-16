-- Add additional fields to opportunities table for detailed job posting
ALTER TABLE opportunities
ADD COLUMN requirements TEXT,
ADD COLUMN skills TEXT[] DEFAULT '{}',
ADD COLUMN deliverables TEXT,
ADD COLUMN duration TEXT;