-- Add foreign key relationships for project_messages and project_files to profiles
ALTER TABLE project_messages 
ADD CONSTRAINT project_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE project_files 
ADD CONSTRAINT project_files_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;