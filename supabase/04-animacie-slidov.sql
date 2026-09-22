-- Nové animácie slidov.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.
--
-- PREČO: pôvodné animácie („nástup“, „odkrývanie textu“, „zoom“) boli všetko
-- len spôsoby, AKO sa slide objaví. Lenže to je prechod a ten sa nastavuje
-- pri slede na obrazovke — klient tú istú vec nastavoval na dvoch miestach
-- a mohli si odporovať.
--
-- Animácia slidu je po novom DEJ NA SLIDE, kým svieti: dýchanie, pomalé
-- priblíženie, pulzujúca cena, postupné odkrývanie riadkov.
--
-- Staré hodnoty sa prekladajú na najbližšie nové:
--   text   -> postupne       (odkrývanie riadkov ostáva, len sa inak volá)
--   zoom   -> priblizovanie  (bol jednorazový, teraz beží dokola)
--   nastup -> ziadna         (nástup je prechod, nie animácia slidu)

alter table public.slides drop constraint if exists slides_animation_check;

update public.slides set animation = 'postupne'      where animation = 'text';
update public.slides set animation = 'priblizovanie' where animation = 'zoom';
update public.slides set animation = 'ziadna'        where animation = 'nastup';

alter table public.slides
  add constraint slides_animation_check
  check (animation in ('ziadna', 'dych', 'priblizovanie', 'zvyraznenie', 'postupne'));
