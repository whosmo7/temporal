-- Decision 028: a day lasts two minutes. New worlds get 120 s; worlds already made keep their own
-- turn_seconds. Matches CONFIG.turnSeconds and LocalBackend's DEFAULT_SETTINGS.

alter table public.settings alter column default_turn_seconds set default 120;
update public.settings set default_turn_seconds = 120 where id = 1;
