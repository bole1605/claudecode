-- Meilenstein 1: Profil je Benutzer. Basis fuer spaetere Mehrbenutzerfaehigkeit:
-- jede Fachtabelle bekommt user_id uuid references auth.users + RLS "user_id = auth.uid()".

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Kein INSERT/DELETE fuer Clients: Anlage erfolgt per Trigger, Loeschung per Kaskade.
revoke all on public.profiles from anon;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
