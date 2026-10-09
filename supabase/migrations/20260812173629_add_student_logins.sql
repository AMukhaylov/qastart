alter table public.profiles add column if not exists login text;

update public.profiles p
set login = lower(regexp_replace(coalesce(nullif(split_part(u.email, '@', 1), ''), 'student'), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || substring(p.id::text, 1, 6)
from auth.users u
where u.id = p.id and p.login is null;

alter table public.profiles alter column login set not null;
create unique index if not exists profiles_login_lower_key on public.profiles (lower(login));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, login)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Ученик'),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(coalesce(new.raw_user_meta_data ->> 'login', 'student_' || substring(new.id::text, 1, 6)))
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;
