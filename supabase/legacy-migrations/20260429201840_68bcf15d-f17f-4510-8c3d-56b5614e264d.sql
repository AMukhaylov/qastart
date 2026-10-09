-- 1. Fix homework_submissions UPDATE: prevent students from self-approving
DROP POLICY IF EXISTS "Users update own homework" ON public.homework_submissions;

CREATE POLICY "Users update own pending homework"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending'::homework_status)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'::homework_status
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND feedback IS NULL
);

-- Ensure admin update policy has a WITH CHECK as well
DROP POLICY IF EXISTS "Admins review homework" ON public.homework_submissions;

CREATE POLICY "Admins review homework"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict profile visibility to self + admins
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));