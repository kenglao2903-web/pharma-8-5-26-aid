DROP POLICY IF EXISTS "Anyone can insert activity logs" ON public.activity_logs;
CREATE POLICY "Insert activity logs with identity"
  ON public.activity_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (employee_id IS NOT NULL AND length(employee_id) = 6 AND action IS NOT NULL AND length(action) > 0);

DROP POLICY IF EXISTS "Anyone can register" ON public.members;
CREATE POLICY "Anyone can register"
  ON public.members FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending' AND length(display_name) BETWEEN 1 AND 100 AND employee_id ~ '^[0-9]{6}$');