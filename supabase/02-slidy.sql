-- Tabuľka slidov. Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.

create table if not exists public.slides (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  template   text not null check (template in ('akcia', 'uvitanie', 'oznamenie', 'novinka')),
  variant    text not null default 'papier'
             check (variant in ('papier', 'tmava', 'oranzova')),
  animation  text not null default 'ziadna'
             check (animation in ('ziadna', 'nastup', 'text', 'zoom')),
  fields     jsonb not null default '{}'::jsonb,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint
);

-- `oznamenie` a `novinka` sú v obmedzení už teraz, aby sa pri 2. etape
-- nemusela meniť schéma. Kód ich zatiaľ neponúka.

-- updated_at musí VŽDY narásť — televízor podľa nej pozná zmenu a dve úpravy
-- v tej istej milisekunde by inak boli neviditeľné. Záruka patrí do databázy,
-- nie do aplikácie.
create or replace function public.slides_bump_updated_at()
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

drop trigger if exists slides_bump_updated_at on public.slides;
create trigger slides_bump_updated_at
  before update on public.slides
  for each row execute function public.slides_bump_updated_at();

-- Zapnuté bez politík = cez verejný anon kľúč sa k dátam nikto nedostane.
-- Aplikácia siaha na tabuľku výhradne zo servera service role kľúčom.
alter table public.slides enable row level security;
