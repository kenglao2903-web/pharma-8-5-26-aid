-- App role enum and admin_roles table (for the dedicated admin Supabase auth account)
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check admin role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view admin_roles"
  ON public.admin_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Members table (custom, employee-id based)
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE CHECK (employee_id ~ '^[0-9]{6}$'),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Anyone can register (insert) a new pending member
CREATE POLICY "Anyone can register"
  ON public.members FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

-- Anyone can look up a member by employee_id (needed for login flow)
CREATE POLICY "Anyone can read members for login"
  ON public.members FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can update member approval
CREATE POLICY "Admins can update members"
  ON public.members FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  employee_id TEXT,
  display_name TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_members_status ON public.members(status);