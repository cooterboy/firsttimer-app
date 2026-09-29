-- The name, units and age typed at sign-up now go into the profile row the moment
-- the account is created, instead of waiting in app memory.
--
-- Before: the sign-up trigger created an empty profile (id only), and the app
-- held name/units/age in memory until its first sign-in could write them. With
-- email confirmation on, the person leaves the app to confirm; if the app was
-- restarted or reloaded before they came back, those values were gone for good
-- and the profile kept a blank name and a NULL age.
--
-- Now the app sends them with supabase.auth.signUp (options.data, stored by
-- Supabase as auth.users.raw_user_meta_data) and this trigger copies them into
-- the new profile row, in the same transaction that creates the account.
--
-- Metadata is whatever the client sent, so each value is checked here: units must
-- be imperial or metric (else the column default), age must be a whole number
-- from 13 to 120 (else NULL — the sign-up form already enforces 13+), and name is
-- trimmed. Accounts created before this migration are not changed.
--
-- search_path is pinned because this runs as security definer.
--
-- Safe to paste more than once.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  age_text text := meta ->> 'age';
begin
  insert into public.profiles (id, name, units, age)
  values (
    new.id,
    coalesce(trim(meta ->> 'name'), ''),
    case when meta ->> 'units' in ('imperial', 'metric') then meta ->> 'units' else 'imperial' end,
    case when age_text ~ '^[0-9]{1,3}$' and age_text::int between 13 and 120 then age_text::int end
  );
  return new;
end;
$$;
