-- Allow admin panel to function with code-only access (no Supabase auth user)
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Anyone can view activity logs"
ON public.activity_logs FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update members" ON public.members;
CREATE POLICY "Anyone can update members"
ON public.members FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Anyone can delete members"
ON public.members FOR DELETE
TO anon, authenticated
USING (true);