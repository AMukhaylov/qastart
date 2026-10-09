insert into storage.buckets (id, name, public, file_size_limit)
values ('homework-attachments', 'homework-attachments', false, 1572864)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;
