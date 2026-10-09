-- UPDATE payloads need the recipient key available to Realtime's row filter.
alter table public.notifications replica identity full;
