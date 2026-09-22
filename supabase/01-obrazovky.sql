-- Schéma pre TV obrazovky.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.

create table if not exists public.screens (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  orientation text not null default 'landscape'
              check (orientation in ('landscape', 'portrait')),

  -- Sled položiek. Zámerne jeden jsonb stĺpec a nie druhá tabuľka:
  -- položky sa vždy čítajú aj zapisujú celé naraz spolu s obrazovkou,
  -- nikdy sa nedotazujú samostatne. Takto je zmena poradia jeden atomický
  -- zápis jedného riadka namiesto transakcie nad dvoma tabuľkami.
  items       jsonb not null default '[]'::jsonb,

  -- Milisekundy, nie timestamp — televízor podľa tohto čísla pozná, že sa
  -- niečo zmenilo, a porovnáva ho priamo.
  updated_at  bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint
);

-- Televízor sa pýta podľa slugu, nie podľa id.
create index if not exists screens_slug_idx on public.screens (slug);

-- updated_at musí VŽDY narásť. Dve úpravy v tej istej milisekunde by inak
-- boli pre televízor neviditeľné a zmena by sa na obrazovku nedostala.
-- Záruka patrí do databázy, nie do aplikácie — inak ju ďalšia implementácia
-- môže nevedomky porušiť.
create or replace function public.screens_bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := greatest(
    (extract(epoch from clock_timestamp()) * 1000)::bigint,
    old.updated_at + 1
  );
  return new;
end;
$$;

drop trigger if exists screens_bump_updated_at on public.screens;
create trigger screens_bump_updated_at
  before update on public.screens
  for each row execute function public.screens_bump_updated_at();

-- Zapnuté bez jedinej politiky = cez verejný anon kľúč sa k dátam nikto
-- nedostane. Aplikácia siaha na tabuľku výhradne zo servera service role
-- kľúčom, ktorý RLS obchádza.
alter table public.screens enable row level security;
