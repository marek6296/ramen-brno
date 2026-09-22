-- Otočenie obrazu pre televízory zavesené na výšku.
-- Spusti v Supabase → SQL Editor → New query → Run.
-- Dá sa spustiť opakovane, nič nezmaže.
--
-- Fyzicky otočená TV aj tak posiela obraz na šírku, takže o 90° musí otočiť
-- samotná stránka. Je to vlastnosť obrazovky, nie položky sledu, preto
-- vlastný stĺpec a nie jsonb `items`.
--
-- Aplikácia funguje aj bez tejto migrácie: pri čítaní si chýbajúci stĺpec
-- doplní na 'none' a pri zápise ho vynechá, keď ho Supabase nepozná. Kým
-- migrácia nebeží, len sa nedá uložiť iné otočenie než 'none'.

alter table public.screens
  add column if not exists rotation text not null default 'none'
  check (rotation in ('none', 'left', 'right'));
