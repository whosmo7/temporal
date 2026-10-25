-- Keeping food for yourself at the oven (decision 033) is a new action, so the action log's type
-- check has to allow it or a turn that used it is refused on commit.
alter table public.actions drop constraint if exists actions_type_check;
alter table public.actions add constraint actions_type_check
  check (type in ('harvest', 'plantCrops', 'plantOrchard', 'repairReservoir', 'digWell', 'fishHunt',
                  'maintain', 'fastTrack', 'water', 'fillCan', 'eat', 'take'));
