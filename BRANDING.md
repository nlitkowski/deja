# Branding: Déjà

Instrukcje dla Claude'a dotyczące identyfikacji wizualnej i języka aplikacji. Obowiązują przy każdej zmianie UI, tekstów, ikon i zasobów.

## Nazwa

- **Déjà**, zawsze z oboma akcentami, wielką literą, bez dopisków typu „app” czy „French”.
- Wersja techniczna (repo, pakiet npm, klucze w `localStorage`, nazwy plików): `deja`.
- Sens: „déjà vu”, czyli „to już widziałeś, przypomnij sobie”. Spaced repetition to kontrolowane déjà vu. Ten motyw może wracać w tekstach, ale z umiarem: najwyżej w jednym miejscu na ekran.
- Nigdy: „Deja” bez akcentów w UI, „DÉJÀ” wersalikami w nagłówkach ani „Déjà Vu” jako nazwa.

## Logo i favicon

- Znak: złote **„à”** (Playfair Display Bold, glif zamieniony na ścieżkę) na granatowym kwadracie.
  - Favicon i UI: zaokrąglony kwadrat (`rx` = 22% boku).
  - Ikony PWA i iOS (`icon-maskable.svg`, `apple-touch-icon.png`): pełny kwadrat bez zaokrągleń, bo system sam przycina rogi.
- Litera zajmuje ok. 75% wysokości kwadratu i jest wyśrodkowana optycznie.
- Logotyp w UI to słowo „Déjà” w Playfair Display Bold, kolor granat na jasnym tle albo złoto na granacie. Znak „à” może stać obok logotypu, ale nie zastępuje w nim litery.
- Nie zmieniaj kolorów znaku, nie dodawaj cieni, gradientów ani obrysów. Nie podmieniaj fontu w znaku. Nie używaj emoji flagi jako logo.

## Kolory

| Rola | Nazwa | Hex |
|---|---|---|
| Główny, tła nagłówków, znak | Granat (navy) | `#1a1f3a` |
| Tło aplikacji | Krem | `#faf7f2` |
| Akcent, XP, nagrody, znak | Złoto | `#c9a84c` |
| Jasne złoto (tła podpowiedzi) | | `#f0e6c8` |
| Informacja, linki | Niebieski | `#2d4a7a` |
| Jasny niebieski (tła tagów) | | `#e8edf5` |
| Błąd, utrata combo | Czerwony | `#c0392b` |
| Poprawna odpowiedź | Zielony | `#27795b` |
| Tekst | | `#2c2c2c` |
| Tekst drugorzędny | | `#6b6b6b` |

- Złoto jest zarezerwowane dla nagród i postępu: XP, combo, korony, odznaki, level-up. Nie używaj go do zwykłych przycisków, bo straci znaczenie.
- Główny przycisk akcji (CTA) jest granatowy z kremowym tekstem.
- Wszystkie kolory definiuj jako zmienne CSS w jednym pliku (`src/styles/tokens.css`) i nie wpisuj hexów w komponentach.
- **Tryb ciemny** (`prefers-color-scheme` plus przełącznik w ustawieniach):
  - tło `#12152a`, karty `#1a1f3a`, tekst `#e2ddd2` (przygaszony krem, żeby nie męczył oczu);
  - złoto bez zmian;
  - zieleń i czerwień rozjaśnione tak, żeby kontrast wynosił co najmniej 4.5:1.

## Typografia

- **Playfair Display** (400 i 700, italic 400): logotyp, nagłówki ekranów, **każde francuskie słowo lub zdanie, które jest przedmiotem nauki** (karta ćwiczenia, wpis w Browse). Dzięki temu francuski jest od razu odróżnialny od interfejsu.
- **Source Sans 3** (300, 400, 600): cały interfejs, tłumaczenia, podpowiedzi, liczby.
- Pole odpowiedzi: Source Sans 3, duże (min. 20 px na telefonie), bez autokorekty i autokapitalizacji (`autocapitalize="off"`, `autocorrect="off"`, `spellcheck="false"`).
- Fonty hostuj lokalnie przez `@fontsource`, bez Google Fonts CDN (aplikacja działa offline).
- Francuska typografia w treści: spacja przed `? ! : ;` (najlepiej niełamliwa wąska ` `), cudzysłowy « … », apostrof typograficzny ’.

## Głos i ton

- UI po polsku, krótko, na „ty”. Ton jak dobry trener na ściance: konkretny, ciepły, bez infantylizmu.
- Francuskie wtrącenia jako przyprawa w momentach emocji, a nie w instrukcjach. Przykłady:
  - poprawna odpowiedź: „Bien !”, „Parfait !”, „Exactement.”
  - combo: „Combo ×2, ça chauffe !”
  - level-up: „Niveau supérieur !”
  - koniec sesji: „Bravo. +120 XP”
  - pusta kolejka: „Rien à revoir. À demain !”
  - przycisk powtórki: „Déjà vu ?”
- Instrukcje i komunikaty o błędach zawsze po polsku i jasno, np. „Brakuje akcentu: à, nie a”.
- Przy błędzie nigdy nie pisz „Źle!”. Pokaż poprawną odpowiedź i wskazówkę, z tonem „prawie, zobacz różnicę”.
- Bez wykrzykników w co drugim zdaniu, bez emoji w tekstach UI. Ikony to zestaw SVG (np. Lucide), a nie emoji.

## Nazewnictwo w grywalizacji

- Tytuły poziomów: Débutant → Touriste → Flâneur → Bavard → Habitué → Parisien → Érudit → Académicien.
- Ligi: Bronze → Argent → Or → Diamant.
- Mastery wpisów to **korony**. Złota jednostka nazywa się „Maîtrisé”.
- Streak to **flamme** (ikona płomienia w złocie), a zamrożenie streaka to „Gel”.
- Nazwy odznak są po francusku, a ich opisy po polsku. Przykład: „Sans faute”: sesja bez ani jednego błędu.

## Ruch i dźwięk

- Animacje krótkie (150–300 ms) i sprężyste (Framer Motion, spring), a level-up i pokonanie bossa mogą trwać dłużej. Respektuj `prefers-reduced-motion`.
- Konfetti tylko w kolorach marki (złoto, krem, granat) i tylko przy level-upie, pokonaniu bossa i nowej odznace.
- Dźwięki: miękkie, „drewniano-dzwonkowe”, bez 8-bitowych efektów z automatów. Poprawna odpowiedź to krótki ton, którego wysokość rośnie z combo. Błąd to cichy, niski dźwięk, nigdy brzęczyk.

## Do / Don't

- ✅ Dużo kremowego oddechu, karty z subtelnym cieniem i lewym paskiem w kolorze akcentu (jak w oryginalnym kompendium).
- ✅ Francuski w Playfair, interfejs w Source Sans.
- ❌ Zielona sowa, maskotki, kreskówkowy styl à la Duolingo.
- ❌ Trójkolorowe flagi, wieże Eiffla, bagietki i inne pocztówkowe klisze.
- ❌ Neon, gradienty, glassmorphism.

## Świadome odstępstwa (już wdrożone, zostają)

Te decyzje zapadły przed wprowadzeniem tego dokumentu i mają pierwszeństwo przed regułami wyżej:

- **UI po francusku** (napisy w `src/i18n/ui.ts`), a pomoc (tłumaczenia, wskazówki) po polsku albo francusku do wyboru. Zasady głosu stosuj do francuskiego UI: krótko, na „tu”, ciepło; komunikaty o błędach jasne i konkretne.
- **Trzy style wizualne** w Réglages: Classique (paleta marki z tego dokumentu), Provence i 8-bit, każdy w trybie jasnym i ciemnym. Paleta i typografia marki obowiązują w stylu Classique; Provence i 8-bit to warianty dla użytkownika.
- **Styl 8-bit**: fonty Press Start 2P i VT323, pikselowe ikony SVG i pikselizowane emoji. To jedyne miejsce, gdzie dozwolona jest estetyka retro.
- **Emoji jako ikony treści** (pakiety, jednostki, fiszki, rodzaje sekcji) zostają, bo pochodzą z pakietów treści i w stylu 8-bit zamieniają się w pikselowe ikony. W tekstach UI emoji nie używamy.
- **Główny przycisk na granatowej karcie powtórki** jest złoty (inaczej zniknąłby na granatowym tle). Gdzie indziej obowiązuje granatowy CTA, a złoto oznacza nagrody i postęp.
- Tokeny kolorów są semantyczne (`--accent`, `--highlight`, `--success`…) i definiowane przez `light-dark()` w `src/styles/tokens.css`.
- **Mniej męczące kolory** we wszystkich stylach: karty w trybie jasnym są w odcieniu tła (`#fdfaf4` w Classique), a nie czysto białe; tekst w trybach ciemnych to przygaszona biel (kontrast ok. 12–13:1 zamiast 15–19:1); w 8-bit ramki i cienie pikselowe mają kolor stonowany, a nie czarny lub biały. Każdy tekst spełnia WCAG AA (4.5:1), a ramki i paski postępu 3:1.
