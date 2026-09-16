-- Allow any authenticated user to update usage_count on public templates
DROP POLICY IF EXISTS "Users can update their templates" ON project_templates;

CREATE POLICY "Users can update their templates"
ON project_templates FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Anyone can increment usage count on public templates"
ON project_templates FOR UPDATE
USING (is_public = true)
WITH CHECK (is_public = true);