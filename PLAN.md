# PLAN.md — Déjà: kolejne etapy

Plan dla Claude Code. Realizuj **etapami, po kolei**: jeden etap to jeden commit (albo kilka małych), a na koniec każdego `npm run lint && npm run build` musi przejść (build uruchamia testy i walidację pakietów). Po każdym etapie zaktualizuj `CLAUDE.md`, jeśli zmieniła się architektura, i odhacz etap w tym pliku.

Zasady wspólne dla wszystkich etapów:
- Stan postępu jest **pochodną logu zdarzeń** (`src/lib/progress/`). Nowe rzeczy (XP, streak, mastery, odznaki) to czyste funkcje liczone z `ProgressEvent[]`, z czasem przekazywanym jako argument. Nigdy nie zapisuj ich jako osobnego, mutowalnego stanu.
- Zdarzeń nie edytujemy i nie usuwamy. Nowy kształt danych to nowy typ lub wersja zdarzenia.
- Logika w `src/game/` i `src/lib/` nie importuje Reacta. Każda funkcja ma testy w Vitest.
- Teksty UI dodawaj w `src/i18n/ui.ts` (UI jest po francusku). Wygląd i ton według `BRANDING.md`, łącznie z sekcją „Świadome odstępstwa”: trzy style Classique / Provence / 8-bit, każdy w trybie jasnym i ciemnym.
- Mobile-first. Każdy nowy ekran sprawdź przy szerokości 360 px i z otwartą klawiaturą.
- Liczby do strojenia (XP, progi, mnożniki) trzymaj w jednym pliku `src/game/config.ts`.

Jeśli synchronizacja z backendem istnieje już lokalnie, a nie ma jej w `main`: najpierw ją dokończ i wypchnij, a dopiero potem zacznij etap 1. Nowe typy zdarzeń z tego planu muszą przechodzić przez sync bez zmian w nim.

---

## Etap 0 — Poprawki w rdzeniu ✅

**0.1 Wydajność `foldEvents`** ✅
- `applyEvent` kopiuje `cards` i `firstSeen` przy każdym zdarzeniu, przez co przeliczenie robi się O(n·m). Zmień `foldEvents` tak, żeby budował stan na jednej mutowalnej kopii w obrębie jednego przeliczenia. Publiczne API zostaje bez zmian, a `applyEvent` może zostać jako czysta funkcja do pojedynczych zdarzeń.
- Dodaj snapshot w store: zapamiętaj ostatni stan i id ostatniego zdarzenia, a nowe zdarzenia nakładaj przyrostowo. Pełne przeliczenie rób tylko wtedy, gdy przychodzi zdarzenie starsze niż snapshot (z drugiego urządzenia).
- Test wydajności: 20 000 syntetycznych zdarzeń × 500 wpisów, fold poniżej 200 ms w Vitest (próg orientacyjny).
- Test równoważności: wynik nowego folda jest identyczny jak starego na losowych logach.

**0.2 Próg „easy” zależny od długości odpowiedzi** ✅ (4000 + 250 ms × znak, max 15 s; przykład 3000 + 250 nie spełniał testu „en” w 4 s)
- W `gradeFromResult` próg `fastAnswerMs` ma zależeć od długości oczekiwanej odpowiedzi, np. `3000 + 250 ms × liczba znaków`, z górnym limitem 15 s.
- `AnswerResult` dostaje `expected`, który już istnieje, więc wystarczy z niego skorzystać. Zmień też zapisywane zdarzenie, jeśli trzeba (pole opcjonalne, bez nowego typu).
- Testy: krótka luka „en” w 4 s daje easy, a zdanie z 40 znakami w 8 s też daje easy.

**0.3 Podwójny baseline** ✅
- Gdy w logu jest kilka zdarzeń `baseline` z różnych urządzeń, scal je kartami: dla każdej karty wybierz tę z późniejszym `lastReviewed`, a przy remisie tę z większym `reps`. Kolejność zdarzeń nie może mieć wpływu na wynik.
- Test: dwa baseline'y w obu kolejnościach dają ten sam stan.

## Etap 1 — PWA ✅

Zrobione z jednym odstępstwem: `registerType: 'prompt'` zamiast `autoUpdate`, bo tylko ten tryb czeka na „Recharger” i nie przeładowuje strony w trakcie sesji. Do sprawdzenia ręcznie: Lighthouse oraz instalacja na Androidzie i iOS.

- Dodaj `vite-plugin-pwa` (`registerType: 'autoUpdate'`), z `base` i `scope` zgodnymi z `BASE_PATH` (`/deja/` na Pages, `/` w dev).
- Manifest:
  - `name` i `short_name`: „Déjà”;
  - `lang: "fr"`, `display: "standalone"`, `start_url` i `scope` z bazą;
  - `theme_color: "#1a1f3a"`, `background_color: "#faf7f2"`;
  - ikony z `public/`: 192, 512 i 512 maskable. Brakujące PNG wygeneruj z `icon-maskable.svg` skryptem w `scripts/` (np. przez `sharp`, jako devDependency) i dodaj je do repo.
- Precache: build, fonty z `@fontsource` i wszystkie pakiety treści. Aplikacja musi w pełni działać offline po pierwszym wejściu.
- Gdy jest dostępna nowa wersja, pokaż dyskretny toast „Nouvelle version · Recharger” zamiast przeładowywać stronę w trakcie sesji.
- Kryteria: Lighthouse PWA bez błędów, instalacja na Androidzie i iOS (Dodaj do ekranu głównego), sesja działa w trybie samolotowym.

## Etap 2 — Gamifikacja, część 1: XP, combo, cel dzienny, streak

**2.1 Zdarzenie sesji**
- Nowy typ zdarzenia `session` (`ProgressEvent` jest unią, więc dodaj wariant), zapisywany przy zakończeniu sesji: `{ sessionId, kind: 'review' | 'unit' | 'boss', unitKey?, startedAt, items, correct, mistakes, maxCombo }`.
- `ReviewEvent` dostaje opcjonalne `sessionId` i `comboBefore: number`, czyli combo w chwili udzielenia odpowiedzi. Combo zależy od kolejności w sesji, więc zapisujemy je w zdarzeniu, a nie liczymy z logu.

**2.2 `src/game/xp.ts`**
- XP za odpowiedź liczone z `ReviewEvent`:
  - baza: production 10, recognition 4 (informacja z rejestru typów ćwiczeń, `production`);
  - mnożniki: bez podpowiedzi ×1.2, near-miss ×0.5, combo ×1.0 / ×1.5 (od 5) / ×2.0 (od 10);
  - błędna odpowiedź: 0.
- Bonusy z zdarzenia `session`: ukończenie +10, sesja perfekcyjna (0 błędów, co najmniej 10 pozycji) +20.
- Malejące XP: wpis z mastery 5 (etap 4) daje ×0.5. Do czasu powstania etapu 4 ten mnożnik jest wyłączony.
- `xpByDay(events): Map<DayKey, number>`, `totalXp(events)`.

**2.3 `src/game/levels.ts`**
- `xpForLevel(n) = round(50 × n^1.5)`, łącznie skumulowane. `levelFromXp(xp) → { level, title, intoLevel, toNext }`.
- Tytuły: Débutant, Touriste, Flâneur, Bavard, Habitué, Parisien, Érudit, Académicien. Po ostatnim zostaje „Académicien”, a numer poziomu rośnie dalej.

**2.4 `src/game/streak.ts`**
- Dzień zaliczony = XP w danym dniu ≥ `settings.dailyGoal`. Dzień nauki już istnieje w zdarzeniach (`day`, reset o 4:00), więc korzystaj z niego.
- Zamrożenie („Gel”): zdobywane za każde 7 zaliczonych dni z rzędu, maksymalnie 2 w zapasie, zużywane automatycznie na dzień niezaliczony. Liczone deterministycznie z historii, bez zdarzeń.
- Zmiana `dailyGoal` działa od dnia zmiany. Przeszłe dni oceniaj według celu obowiązującego wtedy. Do tego potrzebna jest historia celu: zapisuj zmianę jako zdarzenie `setting` `{ key: 'dailyGoal', value }`.
- `streakInfo(events, today) → { current, best, freezes, todayXp, todayDone }`.

**2.5 UI**
- Home:
  - pierścień celu dziennego z `todayXp / dailyGoal`;
  - płomień streaka z liczbą dni („flamme”), z ikoną zamrożenia, jeśli są zapasy;
  - poziom z tytułem i paskiem XP w nagłówku.
- Session:
  - licznik combo widoczny od 3;
  - przy +XP mała animacja „+12” przy karcie;
  - błąd zeruje combo z krótką animacją;
  - dźwięk poprawnej odpowiedzi rośnie wysokością z combo, zgodnie z ustawieniem `sound`;
  - wibracja zgodnie z `vibration`.
- SessionSummary:
  - XP z rozbiciem (odpowiedzi, combo, bonusy);
  - pasek do następnego poziomu z animacją przyrostu;
  - postęp celu dziennego;
  - stan streaka („Jour 12 !”).
- Level-up: pełnoekranowy moment z konfetti w kolorach aktywnej palety (w 8-bit pikselowe), z dźwiękiem. Respektuj `prefers-reduced-motion`.
- Dźwięki: krótkie pliki w `public/sfx/`, generowane syntetycznie przez Web Audio API (oscylator i obwiednia). Bez zewnętrznych plików audio o niejasnej licencji.

**Testy:** XP dla każdej kombinacji mnożników, krzywa poziomów, streak z lukami i zamrożeniami, zmiana celu w trakcie historii, determinizm (ten sam log w innej kolejności daje ten sam wynik).

## Etap 3 — Nowe typy ćwiczeń (generowane z danych)

Rejestr w `src/exercises/registry.ts` już istnieje. Dodaj typy, które **generują się z wpisów** i nie wymagają zmian w pakietach:

**3.1 `multiple-choice`** (recognition)
- Na podstawie przykładu wpisu: luka w miejscu wpisu, 4 opcje.
- Dystraktory najpierw z `confusables` (także międzypakietowych), potem z tej samej jednostki.
- Uruchamia się dopiero wtedy, gdy wpis ma co najmniej 2 dystraktory.

**3.2 `confusable-duel`** (recognition, szybki)
- Grupa 2–3 mylonych wpisów i seria 5 zdań z ich ćwiczeń gap-fill. Przy każdym trzeba wybrać jeden z wpisów, z timerem 8 s na zdanie.
- Wynik aktualizuje SRS każdego wpisu osobno, więc to jedno zdarzenie `review` na zdanie.

**3.3 `match-pairs`** (recognition, na czas)
- 5 par FR ↔ PL z wpisów jednostki: tapnij dwie karty, żeby je połączyć.
- Liczy się jako jedno zdarzenie na parę, z `correct` = bez pomyłki przy tej parze.

Session używa tych typów zgodnie z `recognitionShare` (0.2). Dopiero teraz to ustawienie zaczyna działać. Zadbaj, żeby recognition nigdy nie wypierało production dla wpisów z ostatnim błędem.

## Etap 4 — Mastery, mapa jednostek, bossowie

**4.1 `src/game/mastery.ts`**
- Mastery wpisu 0–5 z karty SRS:
  - 0 = nieznany;
  - 1 = widziany;
  - 2 = interwał ≥ 3 dni;
  - 3 = ≥ 7;
  - 4 = ≥ 21;
  - 5 = ≥ 60 i `reps` ≥ 4.
- Mastery jednostki = minimum z jej wpisów (wpisy `deprecated` pomijamy).
- Teraz włącz malejące XP z etapu 2.2.

**4.2 Mapa**
- Ekran główny pakietu zamiast listy: ścieżka jednostek z koronami (0–5), a ostatnia pozycja w każdej jednostce to boss.
- Kolejna jednostka odblokowuje się, gdy poprzednia ma wszystkie wpisy na mastery ≥ 1. Pakiety z `requires` są zablokowane do ukończenia wymaganych.
- Przy złotej jednostce (wszystkie wpisy na mastery 5) pokazuj plakietkę „Maîtrisé”.
- Mapa ma działać we wszystkich trzech stylach. W 8-bit może wyglądać jak mapa ze starej gry.

**4.3 Bossowie**
- Konfiguracja w JSON jednostki, pole opcjonalne: `boss: { groups: string[][], questions: 10, lives: 3, secondsPerQuestion: 12 }`. `groups` to listy id mylonych wpisów.
- Brak pola oznacza boss generowany automatycznie z `confusables` jednostki.
- Rozszerz schemat Zod i loader, a w `content.test.ts` sprawdzaj, że id z `groups` istnieją.
- Boss odblokowuje się, gdy wszystkie wpisy jednostki mają mastery ≥ 2.
- Rozgrywka: mieszanka `confusable-duel` i `gap-fill`, 3 życia, timer.
- Zdarzenie `session` z `kind: 'boss'` i `defeated: boolean`. Wygrana daje +100 XP i odznakę, przegrana nic nie odbiera.
- Dopisz konfigurację bossa do każdej jednostki w `a1-connecteurs` i `a2-connecteurs` na podstawie istniejących `confusables`.

## Etap 5 — Odznaki i questy

**5.1 `src/game/achievements/`**
- Jeden plik na odznakę: `{ id, title (fr), description (pl/fr przez helpLang), icon, check(ctx) }`, gdzie `ctx` zawiera projekcję (XP, streak, mastery, sesje). Rejestr zbiera je przez `import.meta.glob`.
- Zestaw startowy (około 20):
  - Première séance;
  - Flamme 3 / 7 / 30 / 100;
  - Cent bonnes réponses, 500, 1000;
  - Combo 10 / 25 / 50;
  - Sans faute (perfekcyjna sesja);
  - Pas d'accent manquant (50 poprawnych odpowiedzi z rzędu bez near-miss);
  - Sauveteur (wpis poprawny po 3 błędach z rzędu);
  - Oiseau de nuit (sesja po 23:00), Lève-tôt (przed 7:00);
  - jedna odznaka za każdego pokonanego bossa (generowane);
  - Maîtrisé (pierwsza złota jednostka).
- Odblokowanie wynika z projekcji. To, które toasty już pokazano, trzymaj lokalnie (`localStorage`, poza logiem), żeby toast nie wyskakiwał drugi raz na tym samym urządzeniu.
- Ekran „Succès”: siatka odznak, a nieodblokowane jako szare sylwetki z podpowiedzią.

**5.2 `src/game/quests.ts`**
- 3 questy dzienne wybierane **deterministycznie** z puli: seed = dzień, więc na każdym urządzeniu są te same. Do tego 1 quest tygodniowy.
- Pula, jeden plik na quest: 10 poprawnych z rzędu, pokonaj mylonych bez błędu, sesja bez podpowiedzi, powtórz 5 najsłabszych wpisów, zdobądź 2× cel dzienny i inne.
- Postęp questów liczony z logu. Nagroda to XP, a bonus questa wymaga własnego zdarzenia `quest` przy odbiorze, żeby XP było w logu.
- Karta questów na Home i postęp questów w SessionSummary.

## Etap 6 — Liga z duchami i statystyki

- Liga tygodniowa (od poniedziałku, według dnia nauki): rywalizujesz z własnym XP z 4 poprzednich tygodni oraz z 5 botami, których tempo jest deterministycznie losowane z seeda tygodnia i skalowane do twojej mediany.
- Ligi Bronze → Argent → Or → Diamant: awans z top 3, spadek z ostatnich 2.
- Ekran Stats:
  - heatmapa aktywności z ostatnich 6 miesięcy (XP dziennie);
  - najsłabsze wpisy (najwięcej błędów, najniższy ease) z przyciskiem „Réviser” uruchamiającym sesję tylko z nich;
  - postęp mastery dla każdego pakietu.

## Etap 7 — Uzupełnienie treści Édito

- Cel: każdy wpis w `edito-a1` i `edito-a2` ma **co najmniej 3 ćwiczenia production**, w tym co najmniej jedno `translate-pl-fr`. Obecnie 103 wpisy w A1 i 40 w A2 mają mniej.
- Dodaj do `content.test.ts` test minimalnej liczby ćwiczeń na wpis, najpierw jako ostrzeżenie (`console.warn` z listą), a po uzupełnieniu jako błąd.
- **Prawa autorskie (repo jest publiczne):** zdania mają być w całości autorskie, w zakresie gramatyki i słownictwa danej unité. Nie przepisuj ćwiczeń, dialogów, tekstów ani przykładów z podręcznika Édito.
- Słownictwo A1/A2. Każde zdanie dostaje tłumaczenie `pl`. Jeśli zdanie dopuszcza dwie poprawne odpowiedzi, wpisz obie do `answers` albo przeredaguj zdanie.
- Rób to porcjami po jednej unité na commit, żeby łatwo było przejrzeć zmiany.

---

## Poza zakresem tego planu
- Konta dla wielu użytkowników i funkcje dla lektorów.
- Treści audio i wymowa.
- Monetyzacja.
