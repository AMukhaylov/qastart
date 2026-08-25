-- Avatar files contain personal data. They are served only by the authenticated app route.
update storage.buckets
set public = false
where id = 'avatars';

drop policy if exists "Avatar images are publicly accessible" on storage.objects;

-- This legacy policy predates the current owner-or-admin RLS model. Leaving it in
-- place would let any authenticated student read every profile through PostgREST.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
