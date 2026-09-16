-- Drop the old check constraint
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;

-- Add new check constraint with backlog status
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_status_check 
CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done'));