-- The action log's type check still listed the first eight actions, so a turn that watered,
-- filled the can (decision 027) or ate at the oven (decision 029) was refused on commit.
alter table public.actions drop constraint if exists actions_type_check;
alter table public.actions add constraint actions_type_check
  check (type in ('harvest', 'plantCrops', 'plantOrchard', 'repairReservoir', 'digWell', 'fishHunt',
                  'maintain', 'fastTrack', 'water', 'fillCan', 'eat'));
