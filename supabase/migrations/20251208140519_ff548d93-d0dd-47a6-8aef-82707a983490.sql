-- Allow users to delete their own swipes (for undo functionality)
CREATE POLICY "Users can delete own swipes"
ON public.swipes
FOR DELETE
USING (auth.uid() = user_id);