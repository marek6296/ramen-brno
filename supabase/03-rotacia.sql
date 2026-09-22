-- Otočenie obrazu pre televízory zavesené na výšku.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.
--
-- Fyzicky otočená TV aj tak posiela obraz na šírku, takže o 90° musí otočiť
-- samotná stránka. Je to vlastnosť obrazovky, nie položky sledu, preto
-- vlastný stĺpec a nie jsonb `items`.
--
-- Kým táto migrácia nebeží, aplikácia čítanie prežije (chýbajúci stĺpec si
-- doplní na 'none'), ale ZÁPIS obrazovky Supabase odmietne.

alter table public.screens
  add column if not exists rotation text not null default 'none'
  check (rotation in ('none', 'left', 'right'));
