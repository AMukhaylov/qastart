create policy "Recipients can delete their notifications"
on public.notifications
for delete
to authenticated
using ((select auth.uid()) = recipient_user_id);

grant delete on public.notifications to authenticated;
