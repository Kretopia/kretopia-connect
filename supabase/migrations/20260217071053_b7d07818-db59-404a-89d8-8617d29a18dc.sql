-- Drop the existing update policy and recreate with proper WITH CHECK
DROP POLICY "Users can update their own products" ON public.digital_products;

CREATE POLICY "Users can update their own products"
ON public.digital_products
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Also add a SELECT policy so owners can see their own products (even inactive ones)
CREATE POLICY "Users can view their own products"
ON public.digital_products
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);