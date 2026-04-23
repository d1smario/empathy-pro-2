-- Pro 2 — stato abilitazione coach + flag amministratore piattaforma.
-- Idempotente: ADD COLUMN IF NOT EXISTS, DROP/CREATE trigger.

alter table public.app_user_profiles
  add column if not exists platform_coach_status text
    null
    constraint app_user_profiles_platform_coach_status_chk
      check (platform_coach_status is null or platform_coach_status in ('pending', 'approved', 'suspended'));

alter table public.app_user_profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.app_user_profiles.platform_coach_status is
  'Solo ruolo coach: pending fino ad approvazione admin; approved operativo; suspended bloccato. NULL per ruolo private.';

comment on column public.app_user_profiles.is_platform_admin is
  'Accesso console /api/admin. Modificabile solo da service_role (o trigger bypass).';

create index if not exists idx_app_user_profiles_coach_status
  on public.app_user_profiles (platform_coach_status)
  where role = 'coach';

-- Coach esistenti: operativi da subito (comportamento pre-gate).
update public.app_user_profiles
set platform_coach_status = 'approved'
where role = 'coach' and platform_coach_status is null;

-- Amministratore iniziale (email canonica progetto).
update public.app_user_profiles aup
set is_platform_admin = true
from auth.users u
where u.id = aup.user_id
  and lower(u.email) = lower('m@d1s.ch');

drop trigger if exists trg_app_user_profiles_protect_platform_fields on public.app_user_profiles;

create or replace function public.app_user_profiles_protect_platform_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'service_role' then
      return new;
    end if;
    if coalesce(new.is_platform_admin, false) = true then
      new.is_platform_admin := false;
    end if;
    if new.role = 'coach' and new.platform_coach_status is null then
      new.platform_coach_status := 'pending';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if auth.role() = 'service_role' then
      return new;
    end if;

    new.is_platform_admin := old.is_platform_admin;

    if new.role = 'private' then
      new.platform_coach_status := null;
    elsif new.platform_coach_status is distinct from old.platform_coach_status then
      if old.role = 'private' and new.role = 'coach' and new.platform_coach_status = 'pending' then
        null;
      elsif old.role = 'coach' and new.role = 'coach' and old.platform_coach_status = 'pending' and new.platform_coach_status = 'pending' then
        null;
      else
        new.platform_coach_status := old.platform_coach_status;
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

create trigger trg_app_user_profiles_protect_platform_fields
before insert or update on public.app_user_profiles
for each row execute function public.app_user_profiles_protect_platform_fields();
