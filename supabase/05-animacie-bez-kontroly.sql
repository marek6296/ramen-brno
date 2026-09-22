-- Uvoľnenie kontroly zoznamu animácií.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.
--
-- PREČO: zoznam animácií sa bude ešte dopĺňať a každá nová by inak
-- znamenala ďalšiu migráciu. To je zbytočná brzda pri niečom, čo je čisto
-- vzhľadové — animácia nie je väzba na iné dáta ani nič, na čom by stála
-- správnosť sledu.
--
-- Neznamená to, že do stĺpca môže spadnúť hocičo:
--   * zápis overuje aplikácia proti zoznamu `ANIMACIE` (jediné miesto,
--     odkiaľ ho číta admin, API aj televízor),
--   * pri čítaní sa neznáma hodnota prekladá na „bez pohybu“
--     (`platnaAnimacia` v `lib/slides/types.ts`),
--   * obe pravidlá stráži `tests/prechody.test.ts`.
--
-- Najhoršie, čo sa teda môže stať, je slide bez pohybu — nie rozbitá
-- obrazovka. Kontroly na `template` a `variant` zostávajú, tie sa nemenia.

alter table public.slides drop constraint if exists slides_animation_check;
