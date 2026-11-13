-- Fotky jedál v menu na šírku — dá sa ich zapnúť pri obrazovke v adminovi.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.
--
-- Predvolene sú fotky VYPNUTÉ: klient sa rozhodol pre dosku bez nich, lebo
-- texty boli na TV primalé. Existujúce obrazovky tak po migrácii ostanú bez
-- fotiek, čo je to isté, čo ukazujú aj bez nej.
--
-- Aplikácia funguje aj bez tejto migrácie: pri čítaní si chýbajúci stĺpec
-- doplní na false (bez fotiek) a pri zápise ho vynechá, keď ho Supabase
-- nepozná. Kým migrácia nebeží, len sa nedajú fotky zapnúť.

alter table public.screens
  add column if not exists menu_photos boolean not null default false;
