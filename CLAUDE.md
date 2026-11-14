# CLAUDE.md — Déjà: aplikacja powtórkowa (A1–A2)

## Cel projektu

**Déjà** (technicznie `deja`). Przy każdej zmianie UI, tekstów, ikon i zasobów przestrzegaj `BRANDING.md`, łącznie z jego sekcją o świadomych odstępstwach.

Aplikacja do powtórek z francuskiego (A1) dla jednej osoby: polskojęzycznego ucznia w trakcie kursu. Źródłem treści jest kompendium „Français A1 — spójniki, przyimki i łączniki” (sekcje niżej). Kompendium służy do czytania, a ta aplikacja ma służyć do **aktywnego przypominania**: użytkownik sam wpisuje lub wybiera odpowiedź, a aplikacja planuje powtórki (spaced repetition).

Zasady nadrzędne:
1. **Produkcja > rozpoznawanie.** Domyślnym trybem jest wpisywanie odpowiedzi, a wybór z listy jest tylko trybem pomocniczym. Gamifikacja ma to wzmacniać: najwięcej XP daje wpisywanie, nie klikanie.
2. **Rozszerzalność.** Kompendium spójników i przyimków to tylko pierwszy pakiet. Kolejne tematy (czasowniki, passé composé, liczebniki, słownictwo z kursu) mają dochodzić jako nowe pakiety treści **bez zmian w kodzie aplikacji**. Nowy typ ćwiczenia dodaje się jednym modułem rejestrowanym w rejestrze.
3. **Mocna gamifikacja.** Użytkownik sam deklaruje, że gamifikacja na niego działa. Aplikacja ma dawać poczucie postępu w każdej sesji: XP, poziomy, streak, odznaki, mapa do odblokowywania, combo, efekty dźwiękowe i animacje.

## Stack

- Vite + React + TypeScript (strict), zależności w najnowszych stabilnych wersjach
- Backend w budowie (etap 8 w `PLAN.md`): Cloudflare Worker (Hono) + D1 w `worker/`, na tej samej domenie co aplikacja (`deja.litkowski.com`, API pod `/api/*`, `wrangler.jsonc`). Konto jest opcjonalne, a aplikacja pozostaje **local-first z logiem zdarzeń**. O użytkowniku zapisujemy tylko e-mail. Testy Workera działają w zwykłym Vitest na zamienniku D1 z `node:sqlite` (`worker/test/d1.ts`); zmiany schematu tylko jako nowa migracja w `worker/migrations/`. Deploy: workflow `Deploy` (push na `main` → produkcja; staging przez workflow_dispatch). `env.staging` musi mieć `"routes": []`, bo trasy się dziedziczą.
  - Ustawienia: `localStorage` (`deja:state`, wersjonowanie schematu i migracje w `src/lib/storage.ts`), bo skrypt w `index.html` czyta je synchronicznie.
  - Postęp: **append-only log zdarzeń** w IndexedDB (`src/lib/progress/`): każda odpowiedź to `ReviewEvent` z UUID, `deviceId`, `at`, `day`. Karty SRS, nowe na dziś, a później XP, streak i statystyki to czyste funkcje liczone z logu (`foldEvents`), niezależne od kolejności zdarzeń. Store trzyma log w pamięci w `Projection` (`projection.ts`): nowsze zdarzenia nakłada przyrostowo, a starsze (z innego urządzenia) wymuszają pełne przeliczenie. Kilka zdarzeń `baseline` scala się kartami (nowsza karta wygrywa). Zdarzeń nie edytujemy ani nie usuwamy.
  - Dostęp do logu tylko przez interfejs `ProgressStore`; przyszły sync z backendem to nowa implementacja tego interfejsu (wysyłka niewysłanych zdarzeń, pobranie cudzych od kursora), bez zmian w UI.
  - Stan aplikacji w Zustand (`src/state/appStore.ts`): `settings`, `progress`, `recordAnswer`, `updateSettings`. Ekrany czytają store przez selektory zamiast przekazywać stan w propsach.
- Stylowanie: CSS Modules albo zwykły CSS ze zmiennymi. Bez Tailwinda i bez bibliotek UI
- PWA (vite-plugin-pwa, konfiguracja w `vite.config.ts`): precache całego buildu (pakiety treści są w JS) i fontów latin/latin-ext wszystkich stylów, więc po pierwszym wejściu działa offline. Nowa wersja czeka na toast „Nouvelle version · Recharger” (`UpdateToast`), nigdy nie przeładowuje sama. Ikony PNG w `public/` generuje `npm run icons` z plików SVG
- Walidacja pakietów treści: Zod (schemat jest źródłem typów, przez `z.infer`)
- Animacje: Framer Motion. Konfetti: canvas-confetti. Dźwięki: krótkie pliki w `public/sfx/` odtwarzane przez Web Audio, z wyciszeniem w ustawieniach
- Haptyka: `navigator.vibrate` tam, gdzie jest dostępne
- Testy: Vitest dla logiki (SRS, porównywanie odpowiedzi, generowanie pytań, XP, odznaki, walidacja pakietów)
- Mobile-first: główne użycie to telefon w tramwaju, 5–10 minut naraz

## Komendy

```bash
npm run dev       # serwer deweloperski
npm run build     # build produkcyjny
npm run test      # vitest
npm run lint      # eslint + tsc --noEmit (aplikacja i worker)
npm run dev:worker  # build + lokalne D1 + wrangler dev na :8787 (aplikacja i /api razem)
npm run dev:api     # sam Worker na :8787 dla `npm run dev` (Vite proxuje /api); sekrety i PUBLIC_ORIGIN w .dev.vars (wzór: .dev.vars.example)
npm run db:migrate  # migracje na produkcyjnym D1
```

Po każdej zmianie w `src/lib/` uruchom `npm run test`.

## Struktura

```
worker/                     # backend: Cloudflare Worker (Hono), migracje D1, testy
content/                    # pakiety treści: same dane, zero kodu
  a1-connecteurs/           # pierwszy pakiet (seed z sekcji TREŚĆ KURSU)
    pack.json               # manifest
    units/
      01-prepositions.json
      02-conjunctions.json
      03-contractions.json
      04-expressions.json
  edito-a1/                 # fiszki powtórkowe według podręcznika Édito A1 (Didier, 10 unités)
    pack.json
    sheets/
      unite-01.json … unite-10.json
  <kolejny-pakiet>/...
src/
  content/
    schema.ts               # schematy Zod: Pack, Unit, Entry, Exercise
    loader.ts               # import.meta.glob('/content/*/pack.json') + walidacja
    registry.ts             # zebrane pakiety, lookup po id
  exercises/                # typy ćwiczeń jako wtyczki
    types.ts                # interfejs ExerciseType
    registry.ts
    gap-fill/               # index.ts (logika) + View.tsx (UI)
    translate-pl-fr/
    flashcard/
    multiple-choice/
    confusable-duel/
    match-pairs/
    conjugation-grid/       # do przyszłych pakietów z czasownikami
  game/                     # gamifikacja, czysta logika bez Reacta, liczona z logu zdarzeń (XP z ReviewEvent/SessionEvent, cel dzienny z SettingEvent)
    config.ts               # wszystkie liczby do strojenia
    mastery.ts, map.ts      # mastery 0–5 z karty SRS, blokady jednostek, pakietów i bossów
    boss.ts                 # pytania bossa z grup mylonych wpisów, życia
    achievements/badges/    # jeden plik na odznakę (albo serię progów); rejestr przez import.meta.glob
    quests/daily|weekly/    # jeden plik na quest; wybór deterministyczny z seeda dnia / tygodnia
    league.ts               # liga tygodniowa: duchy z własnych tygodni i boty z seeda
    stats.ts                # heatmapa, najsłabsze wpisy, mastery per pakiet
    xp.ts
    levels.ts
    streak.ts
  lib/
    srs.ts                  # SM-2 lite
    answer.ts               # normalizacja i porównywanie odpowiedzi
    session.ts              # budowanie sesji z kolejki
    storage.ts              # ustawienia w localStorage + migracje schematu
    progress/               # log zdarzeń: events.ts, fold.ts (czyste), projection.ts, store.ts (IndexedDB / pamięć), baseline.ts
  state/
    appStore.ts             # Zustand: settings, progress, log, recordAnswer, recordSession
    useGame.ts              # XP, poziom, streak i stan mapy z logu
  components/
  screens/
```

**Złota zasada:** w `src/` nie ma treści kursu. Cała treść (zdania, tłumaczenia, wskazówki) żyje w `content/`. Jedyny tekst w `src/` to napisy interfejsu w `src/i18n/ui.ts`. Dodanie pakietu to wrzucenie katalogu i nic więcej: loader go znajdzie, zwaliduje i pokaże na mapie.

## Rozszerzalność

### Pakiety treści

```jsonc
// content/a1-connecteurs/pack.json
{
  "id": "a1-connecteurs",          // stabilne, nigdy nie zmieniać
  "version": 1,
  "title": "Spójniki i przyimki",
  "level": "A1",
  "icon": "🔗",
  "requires": [],                   // id pakietów, które trzeba mieć ukończone, żeby ten się odblokował
  "units": ["01-prepositions", "02-conjunctions", "03-contractions", "04-expressions"]
}
```

```ts
// schemat (Zod -> typy)
Unit     { id, title, icon, entries: Entry[], exercises: Exercise[], boss?: BossConfig }
BossConfig { groups: string[][], questions, lives, secondsPerQuestion }  // brak = z confusables jednostki
Entry    { id, fr, pl, def?, examples: {fr, pl}[], tip?: {pl, fr?}, confusables?: string[], tags?: string[] }
Exercise { id, type: string, entryIds: string[], data: unknown }  // `data` walidowane przez schemat danego typu ćwiczenia
```

- Id wpisów są globalne w formacie `<pack>/<entry>`. Postęp SRS i mastery jest powiązany z tym id, więc **id nigdy się nie zmienia**. Wpis można oznaczyć `"deprecated": true`, ale nie usuwać go.
- Loader przy starcie waliduje wszystkie pakiety. W trybie dev błędy wyświetla czytelnie, z plikiem i ścieżką pola. W buildzie produkcyjnym błędny pakiet blokuje build (test w Vitest ładuje wszystkie pakiety).
- `confusables` mogą wskazywać wpisy z innych pakietów.
- Ekran ustawień pozwala **zaimportować pakiet z pliku JSON** (ta sama walidacja). Taki pakiet trafia do IndexedDB, więc można dodawać treści z telefonu bez przebudowywania aplikacji.
- Dołącz `content/_template/` z minimalnym przykładowym pakietem i komentarzem, jak go wypełnić.

### Fiszki powtórkowe (materiał do czytania)

Oprócz ćwiczeń pakiet może mieć `sheets` w `pack.json`: pliki `sheets/<id>.json` ze zwięzłym materiałem do przeczytania (schemat w `src/content/sheet.ts`). Fiszka ma sekcje `grammar` / `vocabulary` / `phrases`, a te składają się z bloków `rule`, `text`, `warning`, `table`, `examples` i `words`. Teksty objaśnień są `{pl, fr}` (język pomocy), przykłady `{fr, pl}`, słówka `{fr, pl, def?}`. Pole `practice` linkuje do jednostek ćwiczeń (`<pakiet>/<jednostka>`). Pakiet może mieć same fiszki, bez jednostek ćwiczeń.

Pakiet `edito-a1` odwzorowuje spis treści podręcznika Édito A1 (Didier): jedna fiszka na unité, z gramatyką, słownictwem i zwrotami. Teksty są autorskie, a z podręcznika pochodzi tylko zakres tematów. Pakiety `edito-a1` i `edito-a2` mają też jednostki ćwiczeń (`units/unite-NN.json`): każdy wpis ma co najmniej 3 ręcznie pisane ćwiczenia production, w tym co najmniej jedno translate-pl-fr (pilnuje tego test w `content.test.ts`). Zdania są w całości autorskie, nie z podręcznika.

### Typy ćwiczeń jako wtyczki

```ts
interface ExerciseType<D> {
  id: string;                               // "gap-fill"
  schema: ZodType<D>;                       // waliduje Exercise.data
  production: boolean;                      // true = użytkownik wpisuje (wyższe XP)
  View: React.FC<{ data: D; onAnswer: (r: AnswerResult) => void }>;
  generate?: (entry: Entry, ctx: GenCtx) => D[];  // opcjonalnie tworzy ćwiczenia automatycznie z wpisów
}
```

Nowy typ ćwiczenia to nowy katalog w `src/exercises/` i jedna linia w `registry.ts`. Ćwiczenia z `generate` buduje loader przy starcie (`generated: true`, id `<wpis>~<typ>-<n>`, deterministycznie, bo zdarzenia się do nich odwołują) z ręcznie pisanych gap-filli. Ćwiczenie o kilku wpisach (confusable-duel, match-pairs) zwraca w `AnswerResult.parts` wynik dla każdego wpisu, a Session zapisuje każdą część jako osobne zdarzenie. Sesja daje recognition tylko wpisom już opanowanym (`reps > 0`), a recognition nigdy nie daje oceny Easy. Session, SRS i XP nie znają konkretnych typów, operują wyłącznie na `AnswerResult { correct, nearMiss, timeMs, hintUsed }`.

Typy na start:
1. **gap-fill**, domyślny: zdanie z luką `___`, użytkownik wpisuje odpowiedź. `data: { sentence, answers[], hint?: {pl, fr?}, pl?, clue? }`
2. **translate-pl-fr**: polskie słowo lub zdanie, użytkownik wpisuje po francusku. Dostępne tylko w trybie pomocy po polsku (`helpLangs: ['pl']`).
3. **flashcard**: FR → PL, odkrycie odpowiedzi i samoocena Again / Hard / Good / Easy.
4. **multiple-choice**: dystraktory brane najpierw z `confusables`, potem z tej samej jednostki. Generowany automatycznie.
5. **confusable-duel**: dwa lub trzy mylone wpisy i seria szybkich zdań, w których trzeba wybrać właściwy. Główny format bossów.
6. **match-pairs**: dopasowanie FR ↔ PL na czas. Generowany automatycznie.
7. **conjugation-grid**: tabela odmiany (je/tu/il…). Teraz nieużywany, przygotowany pod pakiet czasowników.

### Hooki gamifikacji

Logika gry nie ma osobnego event busa: to czyste projekcje logu zdarzeń (`ReviewEvent`, `SessionEvent`, `SettingEvent` w `src/lib/progress/events.ts`). Odznaka albo quest to osobny plik eksportujący `{ id, title, icon, check(ctx) }`, gdzie `ctx` to projekcja logu. Dodanie odznaki nie wymaga zmian w innych miejscach. Pakiet może też zdefiniować własne odznaki w `pack.json` w polu `achievements`, korzystając z deklaratywnych warunków (`{ "type": "unitMastery", "unit": "...", "level": 3 }`).

## Gamifikacja

Wszystkie wartości liczbowe trzymaj w `game/config.ts`, żeby dało się je łatwo stroić.

### XP i poziomy
- Bazowe XP za poprawną odpowiedź: wpisana (production) 10, wybrana lub fiszka 4.
- Mnożniki: bez podpowiedzi ×1.2, near-miss (akcent) ×0.5, odpowiedź poniżej 5 s ×1.1.
- **Combo:** kolejne poprawne odpowiedzi podnoszą mnożnik ×1.0 → ×1.5 → ×2.0 (przy 5 i 10 z rzędu). Licznik combo widać na ekranie, a błąd go zeruje z wyraźną animacją.
- Bonus za ukończenie sesji, bonus za perfekcyjną sesję (0 błędów).
- Poziomy gracza rosną według krzywej `xpForLevel(n) = 50 * n^1.5`. Każdy poziom ma francuski tytuł, np. Débutant → Touriste → Flâneur → Bavard → Parisien…
- Level-up: pełnoekranowa animacja, konfetti i dźwięk.

### Mastery wpisów (korony)
Każdy wpis ma poziom 0–5, liczony z SRS (interval i liczba poprawnych odpowiedzi z rzędu). Na mapie wpisy i jednostki pokazują kolor lub korony. Jednostka ma poziom równy minimum z jej wpisów. Złota jednostka oznacza wszystkie wpisy na poziomie 5.

### Mapa (skill tree)
- Ekran główny to ścieżka jednostek w ramach pakietu, a pakiety układają się w kolejne „regiony”.
- Kolejna jednostka odblokowuje się, gdy poprzednia ma wszystkie wpisy na mastery ≥ 1.
- Na końcu każdej jednostki jest **boss**: 10 pytań typu confusable-duel lub gap-fill, 3 życia, limit czasu na pytanie. Pokonanie bossa daje odznakę i duży bonus XP. Przegrana nic nie odbiera, można spróbować ponownie.

### Streak i cel dzienny
- Dzienny cel XP do wyboru: 30 / 50 / 100. Pierścień postępu na ekranie głównym.
- Streak dni, w których cel był spełniony. **Streak freeze**: zdobywany za 7 dni z rzędu, maksymalnie 2 w zapasie, zużywany automatycznie.
- Dzień liczony jest według strefy Europe/Warsaw (lokalny czas urządzenia), z resetem o 4:00, żeby nocna sesja liczyła się do poprzedniego dnia.

### Questy
- 3 dzienne questy losowane z puli, np. „10 poprawnych pod rząd”, „pokonaj parę dans/en bez błędu”, „sesja bez podpowiedzi”, „powtórz 5 najsłabszych wpisów”.
- 1 quest tygodniowy, większy.
- Pula questów jest rozszerzalna tak samo jak odznaki: jeden plik na quest.

### Odznaki
Na start około 20, w tym: pierwsza sesja; streak 3, 7, 30 i 100 dni; 100, 500 i 1000 poprawnych odpowiedzi; combo 10, 25 i 50; perfekcyjna sesja; każdy boss; złota jednostka; „Pas d'accent manquant” (50 odpowiedzi z akcentem bez near-miss); „Sauveteur” (poprawka wpisu po 3 błędach z rzędu); nocny marek; ranny ptaszek. Nowa odznaka pokazuje się jako toast z dźwiękiem. Galeria odznak wyświetla te jeszcze nieodblokowane jako szare sylwetki z podpowiedzią.

### Rywalizacja z samym sobą
Brak kont i backendu, więc nie ma ligi z innymi graczami. Zamiast tego jest **tygodniowa liga z „duchami”**: użytkownik rywalizuje z własnym XP z poprzednich tygodni oraz z kilkoma botami o deterministycznie wylosowanym tempie. Awans i spadek między ligami (Bronze → Argent → Or → Diamant) liczone są co poniedziałek.

### Feedback i „juice”
- Poprawna odpowiedź: zielony błysk, krótki dźwięk o wysokości rosnącej z combo, lekka wibracja.
- Błędna: delikatne potrząśnięcie karty, poprawna odpowiedź z `tip` i przykładem. Bez kar w XP. Błąd tylko zeruje combo.
- Ekran końca sesji: podsumowanie XP z rozbiciem na bonusy, postęp do następnego poziomu, postęp questów, wpisy, które awansowały w mastery.
- Animacje respektują `prefers-reduced-motion`.

### Anty-wzorce (ważne)
- XP nie może premiować farmienia łatwych trybów. Typy nieprodukcyjne dają mniej XP, a powtarzanie tej samej opanowanej jednostki ma malejące XP (×0.5 po złotej koronie).
- Nie ma mechanik karzących utratą postępu (np. utrata koron przy przerwie). Mastery może spaść tylko wskutek SRS, a nie za samą nieobecność.
- Nie ma „żyć” ograniczających naukę poza bossami.

## Sprawdzanie odpowiedzi (`lib/answer.ts`)

- Porównanie bez względu na wielkość liter, z przyciętymi spacjami i ujednoliconymi apostrofami (`'` = `’`).
- **Akcenty**: brak akcentu (np. `a` zamiast `à`, `ou` zamiast `où`) daje wynik „prawie dobrze”. Odpowiedź jest zaliczona, ale z ostrzeżeniem, a w SRS liczy się jako Hard. Wyjątek: jeśli brak akcentu zmienia słowo na inne poprawne słowo, odpowiedź jest błędna. Dotyczy to `ou`/`où` i `a`/`à`, więc ta para musi mieć test.
- Elizja: `parce que` i `parce qu'` akceptowane zgodnie z kontekstem z `answers`.
- Przy błędzie pokaż poprawną odpowiedź, `tip` z wpisu i przykład. Nie pokazuj samego „źle”.
- Do wpisywania akcentów na telefonie dodaj pasek z przyciskami: à â ç é è ê ë î ï ô ù û ’.

## SRS (`lib/srs.ts`)

Uproszczone SM-2: `ease` (start 2.5, min 1.3), `interval` w dniach, `due`. Oceny Again / Hard / Good / Easy. W ćwiczeniach z wpisywaniem ocena wynika automatycznie z `AnswerResult`: błąd = Again, near-miss lub podpowiedź = Hard, poprawnie = Good, poprawnie i szybko = Easy. Jednostką powtórki jest **Entry**. Wynik ćwiczenia aktualizuje wszystkie wpisy z jego `entryIds`. SRS jest jeden dla wszystkich pakietów, a sesja „Powtórka” miesza je ze sobą.

Sesja: najpierw zaległe (due ≤ dziś), potem maksymalnie 5 nowych dziennie, łącznie około 15–20 kart. Wpis z oceną Again wraca jeszcze w tej samej sesji. Logika ma być czystymi funkcjami z datą przekazywaną jako argument, żeby dało się ją testować.

## Ekrany

- **Map (home)**: ścieżka jednostek i bossów, pierścień celu dziennego, streak z płomieniem, poziom i pasek XP, licznik kart do powtórki oraz duży przycisk „Powtórka” (sesja SRS przekrojowo przez wszystkie pakiety).
- **Session**: jedna karta naraz, duża czcionka FR, licznik combo, pasek postępu sesji. Klawiatura nie może zasłaniać pola odpowiedzi.
- **Boss**: wariant Session z życiami, timerem i osobną oprawą.
- **Session summary**: XP z rozbiciem na bonusy, level-up, questy, awanse mastery.
- **Quests & League**: dzienne i tygodniowe questy, tabela ligi.
- **Achievements**: galeria odznak.
- **Fiches de révision**: lista fiszek per pakiet i widok fiszki (sekcje, tabele, przykłady, słówka, przycisk „S'entraîner”).
- **Browse**: przeglądanie treści pakietów (jak zakładki oryginalnego kompendium), z wyszukiwarką.
- **Stats**: najsłabsze wpisy, heatmapa aktywności (jak na GitHubie), postęp per pakiet.
- **Settings** (ekran „Réglages”): styl (Classique / Provence / 8-bit) i tryb (Système / Clair / Sombre, domyślnie systemowy), język pomocy (polski / francuski), cel dzienny, dźwięk, wibracje, import pakietu JSON, eksport i import całego postępu (karta „Sauvegarde”, `src/lib/backup.ts`: plik z całym logiem zdarzeń i ustawieniami; import **scala** zdarzenia po id, więc nic nie ginie i nic nie liczy się dwa razy), konto Google (karta „Compte”).

## Styl wizualny

Nawiązanie do kompendium: granat `#1a1f3a`, krem `#faf7f2`, złoto `#c9a84c`, akcenty niebieski `#2d4a7a`, czerwony `#c0392b`, zielony `#27795b`. Nagłówki w Playfair Display, tekst w Source Sans 3. To jest styl „Classique”. Motyw = styl (`data-palette`: classic / provence / pixel) × tryb (`data-theme`: light / dark, brak = systemowy). Kolory w tokenach semantycznych (`--bg`, `--accent`, `--highlight`, `--success`, `--danger`…) definiowanych przez `light-dark()`, więc każdy styl opisuje oba tryby w jednym miejscu; styl ustawia też fonty, promienie, grubość ramek i cienie. Komponenty używają tylko tokenów, nigdy surowych kolorów. Styl „8-bit”: Press Start 2P (tytuły, przyciski) i VT323 (tekst), paleta Game Boy (jasny) i NES (ciemny). Skrypt w index.html ustawia styl i tryb przed pierwszym renderem. Ikony interfejsu przez `<Icon>` (znak tekstowy, a w 8-bit rysunek pikselowy SVG), emoji z treści przez `<Emoji>` (w 8-bit pikselizowane na canvasie 14×14), więc nowe pakiety dostają ikony pikselowe automatycznie. Nawigacja: jedno drzewo (`NavTree` w `AppLayout`) na ekranie głównym i w fiszkach: pakiety → lekcje → sekcje otwartej fiszki (scrollspy). Lekcja łączy fiszkę i jednostkę ćwiczeń o tym samym id (wiersz otwiera fiszkę, ▶ uruchamia ćwiczenia). Z boku na szerokich ekranach (≥ 960 px), w szufladzie pod ☰ na telefonie.

## Konwencje

- UI po francusku (napisy w `src/i18n/ui.ts`), treść ćwiczeń po francusku.
- **Język pomocy** do wyboru: polski albo francuski. Dotyczy znaczeń wpisów (`pl` / `def`), wskazówek i podpowiedzi (`{pl, fr}`), tłumaczeń przykładów oraz pomocy pod zdaniem w gap-fill (`pl` = tłumaczenie, `clue` = francuska wskazówka kontekstu, która rozstrzyga lukę bez zdradzania odpowiedzi). Każdy nowy tekst pomocniczy dostaje obie wersje. Typ ćwiczenia, który ma sens tylko w jednym języku, deklaruje `helpLangs`.
- Spacja przed `?` i `!` we francuskich zdaniach (`Tu veux du café ou du thé ?`). Zachowaj ją w danych.
- Żadnych zewnętrznych API, żadnego trackingu. Jedyny wyjątek to logowanie Google, i to tylko przez przekierowanie obsługiwane przez Workera: aplikacja nie ładuje skryptów Google.
- Nowe treści dodawaj tylko w `content/`, jako pakiet zgodny ze schematem. Każdy nowy wpis potrzebuje co najmniej jednego ręcznie napisanego ćwiczenia produkcyjnego (gap-fill albo translate). Ćwiczenia generowane automatycznie są tylko dodatkiem.
- Logika gry (`src/game/`) i SRS to czyste funkcje bez Reacta, z czasem przekazywanym jako argument, pokryte testami.
- Stan zapisany na urządzeniu ma pole `schemaVersion`, a każda zmiana jego kształtu wymaga migracji w `storage.ts`. Nowe dane o postępie zapisuj jako nowy typ zdarzenia w logu (z obsługą w `applyEvent`), nigdy jako osobny zapis stanu.

## Kolejność budowy

1. Schemat Zod, loader, pakiet `a1-connecteurs` z treści poniżej oraz test walidujący wszystkie pakiety
2. `answer.ts` i `srs.ts` z testami
3. Rejestr ćwiczeń, gap-fill i Session (pierwsza grywalna wersja)
4. XP, combo, poziomy, streak i ekran podsumowania
5. Mapa, mastery i bossowie
6. Odznaki, questy i liga
7. Pozostałe typy ćwiczeń, import pakietów, PWA i juice (dźwięki, animacje)

---

## TREŚĆ KURSU (seed pakietu `content/a1-connecteurs/`)

### Przyimki (prépositions)

| id | fr | pl | przykłady (FR → PL) | tip |
|---|---|---|---|---|
| prep-dans | dans | w, do (wewnątrz); za (czas w przyszłości) | Le chat est dans la boîte. → Kot jest w pudełku. / Je pars dans cinq minutes. → Wyjeżdżam za pięć minut. | dans = zamknięta przestrzeń albo „za ile” w przyszłości |
| prep-en | en | w (kraj żeński / transport zamknięty / czas wykonania); materiał | J'habite en France. → Mieszkam we Francji. / Je voyage en train. → Podróżuję pociągiem. / J'ai fini en deux heures. → Skończyłem w dwie godziny. | en + kraj żeński vs au + kraj męski; en voiture/avion vs à vélo/pied |
| prep-a | à | do, w, na (miejsce / godzina / smak) | Je vais à Paris. → Jadę do Paryża. / Le cours commence à 8 heures. → Kurs zaczyna się o 8. / Une glace à la vanille. → Lody waniliowe. | à + le = au, à + les = aux; z la i l' bez zmian |
| prep-de | de | z, od, o (pochodzenie / przynależność / temat) | Je viens de Pologne. → Pochodzę z Polski. / Le livre de Marie. → Książka Marii. / On parle de politique. → Rozmawiamy o polityce. | de + le = du, de + les = des |
| prep-pour | pour | dla, żeby, na (cel / przeznaczenie / planowany czas) | C'est pour toi. → To dla ciebie. / Je travaille pour apprendre. → Pracuję, żeby się uczyć. / Je pars pour deux semaines. → Wyjeżdżam na dwa tygodnie. | |
| prep-sur | sur | na (powierzchnia); o (temat) | Le verre est sur la table. → Szklanka jest na stole. / Un film sur la nature. → Film o naturze. | |
| prep-sous | sous | pod | Le chien dort sous la table. → Pies śpi pod stołem. | |
| prep-avec-sans | avec / sans | z / bez | Un café avec du lait. → Kawa z mlekiem. / Un café sans sucre. → Kawa bez cukru. | |
| prep-chez | chez | u (kogoś, w firmie) | Je suis chez Pierre. → Jestem u Pierre'a. / Je vais chez le médecin. → Idę do lekarza. | chez + osoba, nigdy + miejsce: à la boulangerie, nie „chez la boulangerie” |
| prep-position | devant / derrière / entre | przed / za / między | Il est devant la porte. → On jest przed drzwiami. / Le jardin est derrière la maison. → Ogród jest za domem. / Entre toi et moi. → Między tobą a mną. | |
| prep-pendant-depuis | pendant / depuis | przez (zakończone) / od (trwa nadal) | J'ai dormi pendant deux heures. → Spałem przez dwie godziny. / J'habite ici depuis 2020. → Mieszkam tu od 2020. | depuis = trwa do teraz; pendant = zakończone; en = ile zajęło wykonanie |

Confusables: dans ↔ en ↔ pendant ↔ depuis; en ↔ à (transport, kraje); chez ↔ à; sur ↔ de (temat).

### Spójniki (conjonctions)

Współrzędne:

| id | fr | pl | przykład | tip |
|---|---|---|---|---|
| conj-et | et | i, oraz | J'aime le café et le thé. → Lubię kawę i herbatę. | |
| conj-ou | ou | lub, albo, czy | Tu veux du café ou du thé ? → Chcesz kawę czy herbatę? | nie mylić z où (gdzie) |
| conj-mais | mais | ale, lecz | Je suis fatigué mais content. → Jestem zmęczony, ale zadowolony. | |
| conj-donc | donc | więc, zatem | Il pleut, donc je prends un parapluie. → Pada, więc biorę parasol. | |
| conj-ni | ni… ni… | ani… ani… | Je ne veux ni café ni thé. → Nie chcę ani kawy, ani herbaty. | wymaga ne przed czasownikiem |
| conj-car | car | bo, ponieważ (formalniej) | Je reste chez moi, car je suis malade. → Zostaję w domu, bo jestem chory. | |

Podrzędne:

| id | fr | pl | przykład | tip |
|---|---|---|---|---|
| conj-parce-que | parce que / parce qu' | ponieważ, dlatego że | Je suis heureux parce que c'est vendredi. → Jestem szczęśliwy, bo jest piątek. | przed samogłoską parce qu'il |
| conj-quand | quand | kiedy, gdy | Quand je suis fatigué, je dors. → Kiedy jestem zmęczony, śpię. | |
| conj-si | si | jeśli; czy | Si tu veux, on peut partir. → Jeśli chcesz, możemy wyjść. / Je ne sais pas si c'est vrai. → Nie wiem, czy to prawda. | s'il / s'ils, ale si elle (bez elizji) |
| conj-que | que / qu' | że | Je pense que c'est bien. → Myślę, że to dobrze. / Il dit qu'il est content. → Mówi, że jest zadowolony. | |
| conj-comme | comme | ponieważ (na początku zdania); jak | Comme il pleut, je reste ici. → Ponieważ pada, zostaję tutaj. / Elle est belle comme le soleil. → Jest piękna jak słońce. | |

Confusables: car ↔ parce que ↔ comme; si ↔ quand; ou ↔ où.

### Rodzajniki ściągnięte (articles contractés)

|  | + le | + la | + l' | + les |
|---|---|---|---|---|
| à | au | à la | à l' | aux |
| de | du | de la | de l' | des |

- contr-au-aux: Je vais au cinéma. (à + le) → Idę do kina. / Je parle aux étudiants. (à + les) → Mówię do studentów.
- contr-du-des: Je reviens du bureau. (de + le) → Wracam z biura. / Les livres des enfants. (de + les) → Książki dzieci. Tip: du/de la/des to też partitifs: Je mange du pain.
- contr-pays: en France / de France (kraj żeński); au Japon / du Japon (męski); aux États-Unis / des États-Unis (l.mn.). Tip: kraje na -e są zwykle żeńskie, wyjątki: le Mexique, le Mozambique.

Z tabeli generuj ćwiczenie typu „à + les = ?” dla wszystkich 8 komórek.

### Wyrażenia

Czas: à + godzina (à 8 heures) · de… à… (de 9h à 17h) · en + miesiąc/rok (en janvier, en 2024) · dans + czas (dans 5 minutes) · pendant + czas (pendant 2 heures) · depuis + czas (depuis 3 ans)

Miejsce: à + miasto (à Paris, à Poznań) · en + kraj ż. (en Pologne) · au + kraj m. (au Portugal) · chez + osoba (chez le dentiste) · à côté de = obok (à côté de la gare) · en face de = naprzeciwko (en face de l'école) · près de = blisko (près de chez moi) · loin de = daleko od (loin de la ville)

Transport: **en** voiture / bus / avion / train / métro (w środku) · **à** pied / vélo / moto / cheval (na czymś, otwarte)

### Ćwiczenia z lukami (seed `exercises.ts`)

1. J'habite ___ Pologne. → en
2. Le livre est ___ la table. → sur
3. Je vais ___ cinéma. (à + le) → au
4. Elle part ___ dix minutes. → dans
5. Un café ___ sucre, s'il vous plaît. → sans
6. Il travaille ___ 2019. (nadal pracuje) → depuis
7. Je suis ___ Pierre. → chez
8. Je voyage ___ train. → en
9. Il est fatigué ___ content. → mais
10. ___ tu veux, on y va. → Si
11. Je reste ici ___ il pleut. → parce que
12. La pharmacie est ___ l'hôpital. → en face de

Każda z czterech sekcji powyżej to osobna jednostka (unit) z własnym bossem. Boss dla przyimków: dans/en/pendant/depuis. Boss dla spójników: car/parce que/comme oraz si/quand. Boss dla rodzajników: au/aux/du/des z krajami. Boss dla wyrażeń: en/à w transporcie i miejscu.

**Zadanie dla Claude'a przy pierwszym uruchomieniu:** rozbuduj zestaw do co najmniej 3 ćwiczeń na każdy wpis, łącznie ok. 80–100. Używaj tylko słownictwa A1, a każdemu zdaniu daj tłumaczenie `pl`. Wyraźnie celuj w pary mylone (dans/en/pendant/depuis, en/au/aux z krajami, en/à z transportem, chez/à, si/s'il, ou/où). Każde wygenerowane zdanie sprawdź pod kątem poprawności gramatycznej. Jeśli zdanie dopuszcza dwie poprawne odpowiedzi, wpisz obie do `answers` albo przeredaguj zdanie.
