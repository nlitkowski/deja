# Szablon pakietu treści

Skopiuj ten katalog do `content/<id-pakietu>/` (bez podkreślnika na początku: katalogi `_*` są pomijane przez aplikację) i zmień `id` w `pack.json` na nazwę katalogu.

## `pack.json`

| pole | znaczenie |
|---|---|
| `id` | stałe id pakietu, równe nazwie katalogu; **nigdy go nie zmieniaj** |
| `version` | podbijaj przy zmianie treści |
| `title`, `level`, `icon` | wyświetlane na mapie |
| `requires` | id pakietów, które trzeba ukończyć, żeby ten się odblokował |
| `units` | kolejność jednostek; każda to plik `units/<id>.json` |
| `accentPairs` | opcjonalnie: pary słów, w których brak akcentu daje inne słowo (`["ou", "où"]`), więc odpowiedź jest błędna, a nie „prawie dobrze” |
| `achievements` | opcjonalnie: odznaki z deklaratywnym warunkiem, np. `{ "type": "unitMastery", "unit": "01-example", "level": 3 }` |

## `units/<id>.json`

- `entries`: wpisy `{ id, fr, pl, def?, examples: [{ fr, pl, audio? }], tip?, confusables?, tags?, deprecated?, audio? }`.
  Id wpisu jest globalnie `<pakiet>/<wpis>` i wiąże postęp SRS, więc **nie zmieniaj go i nie usuwaj wpisów**; oznacz je `"deprecated": true`.
  `confusables` mogą wskazywać wpisy z innych pakietów: `"a1-connecteurs/prep-dans"`.
- `exercises`: `{ id, type, entryIds, data }`. Każdy wpis potrzebuje co najmniej jednego ćwiczenia produkcyjnego:
  - `gap-fill`: `{ sentence: "… ___ …", answers: [...], hint?, pl?, clue? }` (dokładnie jedna luka `___`)
  - `translate-pl-fr`: `{ pl, answers: [...], hint? }` (tylko w trybie pomocy po polsku)
- `boss` (opcjonalnie): `{ groups, questions, lives, secondsPerQuestion }`. `groups` to listy id mylonych wpisów (np. `[["prep-dans", "prep-en"]]`); grupa z jednym wpisem daje tylko pytania z wpisywaniem. Bez pola boss powstaje automatycznie z `confusables` jednostki.

## `sheets/<id>.json` (fiszki do czytania, opcjonalnie)

Wpisz id w `"sheets": [...]` w `pack.json`. Fiszka: `{ id, label?, title, icon, summary?, sections, practice? }`, sekcja `{ kind: "grammar" | "vocabulary" | "phrases", title, blocks }`. Bloki:

| `type` | pola | uwagi |
|---|---|---|
| `rule`, `text`, `warning` | `text: { pl, fr }` | reguła w ramce / zwykły tekst / typowy błąd |
| `table` | `head`, `rows`, `title?` | komórki po francusku; każdy wiersz ma tyle komórek co `head` |
| `examples` | `items: [{ fr, pl }]`, `title?` | `pl` widać tylko z pomocą po polsku |
| `words` | `items: [{ fr, pl, def? }]`, `title?` | `def` to krótka francuska glosa dla trybu FR |

`**pogrubienie**` i `\n` działają we wszystkich tekstach. `practice: ["<pakiet>/<jednostka>"]` dodaje przyciski „S'entraîner”. Wzór: `content/edito-a1/sheets/unite-04.json`.

## Nagrania (`audio`)

Każdy francuski tekst jest nagrywany syntezą mowy przy buildzie (`npm run tts`, opis w `scripts/tts.ts`): `fr` wpisu i jego przykładów, przykłady i słówka z fiszek, pełne zdania z tabel w fiszkach (od wielkiej litery, zakończone `.`, `?` lub `!`), zdanie z `gap-fill` z luką wypełnioną pierwszą odpowiedzią i pierwsza odpowiedź z `translate-pl-fr`. Nawiasy (`(avoir)`, `(fam.)`) nie są czytane, a `a / b` czyta się jak wyliczenie.

Opcjonalne pole `audio` we wpisie, w przykładzie, w ćwiczeniu (obok `data`, nie w nim) i w pozycji bloku `examples` / `words`:

```jsonc
"audio": {
  "skip": true,        // nie nagrywaj (np. nazwa własna, którą synteza przekręca)
  "text": "…",         // co czytać, jeśli różni się od zapisu (liczby, skróty, nazwy liter)
  "dictation": false   // nie używaj w dyktandzie (homofony: il parle / ils parlent)
}
```

Tabela przyjmuje tylko `"audio": { "skip": true }`. Po zmianie treści uruchom `npm run tts` i zacommituj `content/_audio/manifest.json`; test nie przepuści tekstu bez nagrania.

## Język pomocy (polski / francuski)

Użytkownik wybiera, w jakim języku widzi materiały pomocnicze. Każdy tekst pomocniczy ma więc dwie wersje:

| tryb PL | tryb FR |
|---|---|
| `pl` wpisu (znaczenie) | `def`: proste wyjaśnienie po francusku |
| `tip.pl`, `hint.pl` | `tip.fr`, `hint.fr` (bez nich pokazuje się wersja polska) |
| `pl` w gap-fill (tłumaczenie zdania) | `clue`: krótka francuska wskazówka kontekstu, np. `"(≠ derrière)"`, `"(durée terminée)"` |
| przykłady z tłumaczeniem | same przykłady po francusku |

`clue` nie może zdradzać odpowiedzi, ale musi rozstrzygać lukę tak samo jak tłumaczenie: bez niej „Le chat est ___ la boîte.” przyjmuje sur, sous, dans…

Zasady treści: spacja przed `?` i `!` we francuskich zdaniach; jeśli luka dopuszcza dwie poprawne odpowiedzi, wpisz obie do `answers` albo przeredaguj zdanie.

`npm run test` waliduje wszystkie pakiety i ten szablon.
