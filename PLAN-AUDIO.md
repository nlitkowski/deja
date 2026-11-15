# PLAN-AUDIO.md — Déjà: słuchanie i mówienie

Plan dla Claude Code. Zaczynaj dopiero **po zakończeniu etapu 8 z `PLAN.md`** (synchronizacja), bo nowe zdarzenia muszą od razu przechodzić przez sync.

Kolejność etapów: A0 → A1 → A2 → A3 → A4 → A5 → S1 → S2 → S3 → **P0 → S4 → P1**. P0 (uprawnienia i limity) musi być gotowe, zanim powstanie cokolwiek, co płaci za użycie. Zasady z `PLAN.md` obowiązują dalej:
- jeden etap = jeden commit (albo kilka małych);
- `npm run lint && npm run build` musi przejść;
- stan wyliczany z logu zdarzeń;
- logika bez Reacta, z testami;
- teksty UI w `src/i18n/ui.ts`, wygląd według `BRANDING.md`.

## Założenia

1. **Słuchanie i mówienie to osobne umiejętności tego samego wpisu.** Wpis ma do trzech kart SRS: `written` (to, co jest dziś), `listening` i `speaking`. Dobre wyniki w czytaniu nie oznaczają, że rozumiesz ze słuchu, a błąd w dyktandzie nie resetuje karty pisanej.
2. **Nic, co już zdobyte, nie znika.** Cała dotychczasowa historia to `written`. Odblokowywanie jednostek i bossów dalej zależy tylko od `written`. Po wdrożeniu audio nic na mapie się nie zamyka, a mastery i XP zostają takie same.
3. **Podstawą mówienia jest samoocena.** Rozpoznawanie mowy w przeglądarce dla francuskiego jest nierówne. Na iOS praktycznie nie działa, a na Chrome wysyła nagranie do Google. Mówienie ocenia się samemu, porównując swoje nagranie z wzorcem. Maszynowa ocena wymowy (Azure, etap S4) to **funkcja płatna lub przyznawana ręcznie**, bo każde użycie kosztuje.
4. **Tryb cichy.** Aplikacja jest używana w tramwaju. Jednym przełącznikiem musi się dać wyłączyć ćwiczenia z dźwiękiem i mikrofonem na daną sesję albo na stałe.
5. **Nagrania użytkownika nie opuszczają urządzenia.** Żyją w pamięci tylko na czas jednej karty. Jedyny wyjątek to ocena wymowy (S4), włączana świadomie: nagranie idzie przez naszego Workera do Azure i nigdzie nie jest zapisywane.
6. **Wszystko, co generuje koszt per użytkownik, jest za uprawnieniem.** Serwer egzekwuje uprawnienia i limity, a UI tylko je odzwierciedla. TTS jest generowany raz przy buildzie, więc nie ma kosztu per użytkownik i jest dostępny dla wszystkich.

---

## Etap A0 — Umiejętności w modelu danych ✅

- `type Skill = 'written' | 'listening' | 'speaking'`.
- `cardKey(entryId, skill = 'written')`: dla `written` zwraca samo `entryId` (zgodność z istniejącymi danymi), dla pozostałych `entryId#listening` albo `entryId#speaking`. Jeśli funkcja już istnieje (porządki z `PLAN.md`), tylko ją rozszerz.
- `ReviewEvent` dostaje opcjonalne `skill?: Skill`, a brak pola oznacza `written`. Nie powstaje nowy typ zdarzenia ani migracja, a stare zdarzenia nie zmieniają znaczenia.
- `ExerciseType` dostaje pole `skill: Skill`. Istniejące typy mają `written`.
- Mastery liczone osobno dla każdej umiejętności: `entryMastery(cards, entryId, skill)`. Mastery jednostki, odblokowania, bossowie i „Maîtrisé” korzystają z `written`, zmiana nie może ich dotknąć.
- Testy:
  - log bez pola `skill` daje projekcję identyczną jak przed zmianą (test regresji na zapisanym logu);
  - odpowiedź `listening` nie zmienia karty `written`.

## Etap A1 — Nagrania: generowanie, hosting, manifest

**Źródło głosu:** TTS generowany raz, przy buildzie, nie w przeglądarce. `speechSynthesis` brzmi inaczej na każdym urządzeniu i często słabo.
- Interfejs `TtsProvider { synthesize(text, voice, lang): Promise<ArrayBuffer> }`, implementacja **Azure AI Speech, Neural** (francuskie głosy fr-FR).
  - Darmowy limit 0,5 mln znaków miesięcznie, a cała obecna treść to około 140 tys. znaków (~3 600 zdań).
  - Ten sam zasób Azure obsłuży ocenę wymowy w S4.
  - Dostawcę ma się dać podmienić bez zmian w reszcie (np. na Google Chirp 3 HD).
- Przed pierwszym pełnym generowaniem `scripts/tts.ts --sample 20` generuje 20 losowych zdań do odsłuchu, żeby wybrać głosy.
- Dwa głosy, kobiecy i męski, przypisywane deterministycznie po hashu zdania. Dzięki temu słychać różnorodność, a jedno zdanie zawsze ma ten sam głos.
- Format MP3 mono około 64 kbps. Działa wszędzie, w tym w Safari na iOS.

**Co nagrywamy:** wszystkie pola `fr` w treści:
- przykłady wpisów;
- przykłady i tabele w fiszkach (sheets), tylko zdania, nie nagłówki;
- pełne zdania z ćwiczeń `gap-fill`, czyli luka `___` wypełniona pierwszą odpowiedzią;
- odpowiedzi z `translate-pl-fr`, czyli pierwsza wersja z `answers`.

Tekst przed hashowaniem jest normalizowany (NFC, ujednolicone spacje i apostrofy). Klucz pliku to `sha256(provider + voice + text)`, więc zmiana tekstu albo głosu automatycznie oznacza nowe nagranie.

**Opcjonalne pole w schemacie treści** (wpis, przykład, ćwiczenie):

```jsonc
"audio": {
  "skip": true,            // nie nagrywaj (np. zdanie z nazwą własną, którą TTS przekręca)
  "text": "…",             // co czytać, jeśli różni się od zapisu (np. liczby, skróty)
  "dictation": false       // nie używaj w dyktandzie (homofony: il parle / ils parlent)
}
```

Rozszerz schemat Zod i dopisz opis do `content/_template/README.md`.

**Hosting:** bucket Cloudflare R2 (`deja-audio`), wystawiony pod własną domeną `deja-audio.litkowski.com`.
- Nagłówek `Cache-Control: public, max-age=31536000, immutable`, bo pliki są nazwane hashem.
- CORS na bucket dla originów aplikacji (potrzebny do Cache API przy pobieraniu offline).
- Nagrania **nie trafiają do repo**.

**Skrypt `scripts/tts.ts`:**
- Zbiera wszystkie teksty, porównuje je z manifestem `content/_audio/manifest.json` (`hash → { text, voice, bytes }`, commitowany), generuje brakujące i wrzuca je do R2.
- `--dry-run` wypisuje liczbę nowych zdań i znaków (do szacowania kosztu) i niczego nie wysyła.
- `--prune` wypisuje nagrania w R2, których nie ma w manifeście. Usuwa je tylko z flagą `--yes`.
- Klucze dostawcy TTS i R2 trzymaj w sekretach GitHub Actions i w `.dev.vars` lokalnie, nigdy w repo.

**CI:** job `audio` uruchamiany, gdy zmienia się `content/**`. Generuje brakujące nagrania przed buildem aplikacji. Test w `content.test.ts`: każdy tekst do nagrania (bez `audio.skip`) ma wpis w manifeście, inaczej build nie przechodzi.

## Etap A2 — Odtwarzanie (bez nowych ćwiczeń)

Najtańszy, a bardzo wartościowy krok: dużo francuskiego „na ucho” przy tym, co już robisz.
- Komponent `<Play text|hash />`: ikona głośnika i przytrzymanie dla wolniejszego tempa. Wolniej oznacza `playbackRate = 0.75` z `preservesPitch`, bez osobnych plików.
- Przycisk odtwarzania przy przykładach wpisów, w fiszkach i w Browse.
- **Po odpowiedzi w każdym ćwiczeniu pisemnym** pokaż przycisk z pełnym zdaniem. Opcja w Réglages: „Lire la phrase après la réponse” (auto, ręcznie albo nigdy).
- iOS: pierwsze odtworzenie musi wynikać z gestu użytkownika, więc „odblokuj” audio przy pierwszym tapnięciu w aplikacji.
- **Offline:**
  - nagrania są cache'owane w czasie działania aplikacji (Workbox CacheFirst dla `deja-audio.litkowski.com`, z limitem rozmiaru);
  - w jednostce jest przycisk „Télécharger l'audio”, który pobiera do cache wszystkie jej nagrania, z postępem i rozmiarem;
  - w Réglages widać zajęte miejsce i jest przycisk „Vider”.
- Brak nagrania lub sieci nigdy nie blokuje sesji. Przycisk wtedy po prostu jest nieaktywny.

## Etap A3 — Tor „Écoute” w SRS i sesjach

- **Kiedy wpis wchodzi do słuchania:** wpis z `written` mastery ≥ 1 i z nagraniem zostaje kandydatem do `listening`. Osobny limit nowych kart dziennie dla słuchania (domyślnie 5), w `game/config.ts`.
- **Szybszy start dla znanych wpisów:** jeśli pierwsza odpowiedź `listening` jest poprawna, a `written` mastery wynosi co najmniej 3, karta dostaje od razu interwał 3 dni zamiast 1. Nie zakładaj z góry, że wpis jest znany ze słuchu.
- **Sesja „Révision”** miesza zaległe karty wszystkich umiejętności, ale nie więcej niż około 30% słuchania na sesję.
- **Tryb cichy:**
  - przełącznik 🎧 / 🔇 na Home i w nagłówku sesji (stan pamiętany w ustawieniach), plus automatyczny tryb cichy, gdy nie ma nagrań offline i nie ma sieci;
  - w trybie cichym sesja nie zawiera kart `listening` ani `speaking`;
  - zaległe karty słuchania czekają i **nie są** karane, bo SRS liczy tylko udzielone odpowiedzi.
- Home pokazuje osobne liczniki zaległych kart dla pisania, słuchania i mówienia.

## Etap A4 — Ćwiczenia ze słuchu (generowane z danych)

Każdy typ ma `skill: 'listening'` i generuje się z istniejącej treści. Nagranie jest odtwarzane automatycznie, a przycisk powtórki (także wolniej) jest zawsze dostępny. Liczba odtworzeń jest zapisywana w zdarzeniu jako `replays`, bez wpływu na XP.

1. **`dictee-trous`** (production, główny typ na A1): słyszysz całe zdanie, widzisz je z luką, wpisujesz brakujące słowo. Źródłem są zdania z `gap-fill`. Akcenty i near-miss jak w `answer.ts`.
2. **`dictee`** (production, pełne dyktando): tylko zdania do 8 słów i bez `audio.dictation: false`.
   - Porównanie słowo po słowie z wizualnym diffem (zielone, czerwone i brakujące słowa).
   - Zaliczenie, gdy wszystkie słowa są poprawne. Near-miss, gdy brakuje jedynie akcentów, interpunkcji lub wielkości liter.
   - Zgodność z `answers` dla wariantów (np. `on` / `nous`).
3. **`ecoute-sens`** (recognition): słyszysz zdanie i wybierasz jedno z 4 polskich tłumaczeń. Dystraktory pochodzą z tej samej jednostki.
4. **`paires-minimales`** (recognition): słyszysz jedno z pary i wybierasz zapis.
   - Pary wybieramy **tylko takie, które brzmią inaczej**: dessus/dessous, le/les, du/deux, je fais/j'ai fait, il a/il va.
   - Homofony odpadają: ou/où, a/à, et/est, ces/ses.
   - Lista par jako dane w pakiecie (`content/<pack>/minimal-pairs.json`), z walidacją, że każda strona ma nagranie.
   - To jest główny format bossa ze słuchu.

Testy:
- generatory nie biorą zdań z `audio.skip` ani `dictation: false`;
- diff dyktanda: pominięte, nadmiarowe i przestawione słowa;
- homofon w `paires-minimales` przerywa walidację pakietu.

## Etap A5 — Gamifikacja słuchania

- **XP:**
  - `dictee` 12 (najtrudniejsze), `dictee-trous` 10, recognition 4;
  - mnożniki i combo jak dotąd;
  - malejące XP przy `listening` mastery 5.
- **Mapa:**
  - przy każdej jednostce drugi wskaźnik postępu, ikona słuchawek z poziomem 0–5;
  - złota jednostka ze słuchu dostaje plakietkę „Oreille d'or”.
  - Odblokowania bez zmian (`written`).
- **Boss ze słuchu**, opcjonalny, odblokowany przy `listening` mastery jednostki ≥ 2: `paires-minimales` + `dictee-trous`, 3 życia. Zdarzenie `session` z `kind: 'boss-listening'`.
- **Odznaki:**
  - Première écoute;
  - Oreille fine (50 dyktand bez błędu);
  - Sans sous-titres (sesja słuchania bez wolniejszego tempa i bez powtórek);
  - Oreille d'or (pierwsza złota jednostka ze słuchu).
- **Questy:** dodaj do puli, np. „5 dictées sans faute”, „une séance d'écoute”. Questy ze słuchem nie są losowane w dniu, w którym tryb cichy był włączony przez cały czas, bo wtedy nie da się ich zrobić. Aby losowanie pozostało deterministyczne, zamiast tego zastąp je w puli odpowiednikiem pisemnym, jeśli tor słuchania jest wyłączony w ustawieniach.

## Etap S1 — Mówienie: powtarzanie z nagraniem (shadowing)

- Typ **`repeter`** (`skill: 'speaking'`):
  1. odsłuchujesz wzorzec;
  2. nagrywasz siebie (przytrzymaj, żeby mówić);
  3. aplikacja odtwarza na zmianę wzorzec i twoje nagranie, a przycisk „A/B” pozwala porównać jeszcze raz;
  4. oceniasz się sam: Again / Hard / Good / Easy.
- Nagrywanie przez `MediaRecorder` w formacie, który przeglądarka obsługuje (`audio/webm` lub `audio/mp4` na iOS). Nagranie żyje w pamięci tylko do następnej karty, bez zapisu na dysk i bez wysyłki.
- Uprawnienie do mikrofonu prosimy dopiero przy pierwszym ćwiczeniu mówienia, z krótkim wyjaśnieniem. Odmowa wyłącza tor mówienia i daje informację, jak to zmienić. iOS w trybie PWA potrafi pytać o mikrofon przy każdym uruchomieniu, więc obsłuż to bez błędów.
- Do mówienia trafiają wpisy z `listening` mastery ≥ 1, bo najpierw słyszysz, potem mówisz. Osobny limit nowych kart dziennie (domyślnie 3).
- Wizualizacja: prosta fala lub poziom głośności w trakcie nagrywania, żeby było widać, że mikrofon działa. Bez oceny wymowy.

## Etap S2 — Mówienie: z polskiego na francuski

- Typ **`dire`** (`skill: 'speaking'`, production): widzisz polskie zdanie (z `translate-pl-fr` albo z przykładu) i mówisz je po francusku. Potem pokazuje się zapis i nagranie wzorcowe, możesz odsłuchać swoje nagranie i oceniasz się sam.
- **Podpowiedź z rozpoznawania mowy** (opt-in w Réglages, domyślnie wyłączona):
  - jeśli przeglądarka ma `SpeechRecognition` z `lang: 'fr-FR'`, po nagraniu pokaż „Compris : …” i porównanie słów z wzorcem, z tym samym diffem co w dyktandzie;
  - to jest wyłącznie podpowiedź, a ocena dalej należy do użytkownika;
  - przy włączaniu jasna informacja, że Chrome wysyła nagranie do Google.
- Brak wsparcia albo odmowa: ćwiczenie działa normalnie, tylko bez podpowiedzi.

## Etap S3 — Gamifikacja mówienia

- **XP:** `repeter` 6, `dire` 8. XP jest celowo niższe, bo ocena jest własna. Combo działa, odblokowań brak.
- **Mapa:** trzeci wskaźnik (mikrofon). Złota jednostka z mówienia to „Langue bien pendue”.
- **Odznaki:**
  - Premiers mots;
  - Perroquet (100 powtórzeń);
  - Bavard en vrai (10 sesji z mówieniem).
- **Questy:** „Répète 10 phrases”, „Dis 5 phrases sans regarder”.
- **Podsumowanie sesji:** rozbicie XP na pisanie, słuchanie i mówienie.

## Etap P0 — Uprawnienia (entitlements) i limity zużycia

Fundament pod płatne lub ręcznie przyznawane funkcje. Tabela `entitlements` już istnieje w schemacie D1 (pusta). Jeśli jej kształt nie pasuje, zmień go nową migracją.

**Model danych (D1):**
- `entitlements(user_id, feature, source, granted_at, expires_at NULL, note)`:
  - `feature` np. `pronunciation`, `admin`;
  - `source`: `manual` teraz, później `paddle`;
  - unikalność `(user_id, feature)`;
  - `expires_at = NULL` oznacza bezterminowe uprawnienie.
- `usage(user_id, feature, period, amount)` z `period = 'YYYY-MM'`. Dla wymowy `amount` to sekundy audio. Inkrementacja atomowa (`INSERT … ON CONFLICT DO UPDATE SET amount = amount + ?`).

**API (Worker):**
- `GET /me` zwraca dodatkowo `entitlements: string[]` (tylko aktywne) i `usage` dla funkcji limitowanych (`{ used, limit, period }`).
- Middleware `requireEntitlement(feature)`: 401 bez sesji, 403 bez uprawnienia lub po wygaśnięciu.
- Limity w zmiennych środowiskowych (`wrangler.jsonc`, osobno staging i prod):
  - `PRONUNCIATION_USER_MONTHLY_SECONDS` (domyślnie 1800, czyli 30 min na użytkownika);
  - `PRONUNCIATION_GLOBAL_MONTHLY_SECONDS` (domyślnie 16 200, czyli 4,5 h, poniżej darmowych 5 h Azure). Po przekroczeniu globalnego limitu odpowiedź 429 z kodem `global_quota` dla wszystkich, co działa jako bezpiecznik kosztów;
  - `PRONUNCIATION_ENABLED` (`true`/`false`): wyłącznik awaryjny bez deployu kodu.

**Front:**
- Store konta trzyma `entitlements` i `usage` z `/me`. Hook `useEntitlement(feature)`.
- Funkcja bez uprawnienia jest **widoczna, ale zablokowana**: kłódka i krótki opis „Évaluation de la prononciation — réservée aux comptes Premium”. Na razie bez przycisku zakupu, tylko informacja. Bez konta lub offline działa tak samo.
- UI nigdy nie jest jedyną ochroną. Każde wywołanie płatnej funkcji serwer sprawdza sam.

**Ręczne nadawanie uprawnień (do czasu panelu admina):** dopisz do README gotowe komendy:

```bash
# nadaj
npx wrangler d1 execute deja --remote --command \
  "INSERT INTO entitlements (user_id, feature, source, granted_at, note)
   SELECT id, 'pronunciation', 'manual', datetime('now'), 'ręcznie' FROM users WHERE email = 'ktos@example.com'
   ON CONFLICT(user_id, feature) DO UPDATE SET expires_at = NULL"
# odbierz
npx wrangler d1 execute deja --remote --command \
  "DELETE FROM entitlements WHERE feature = 'pronunciation'
   AND user_id = (SELECT id FROM users WHERE email = 'ktos@example.com')"
# podgląd zużycia
npx wrangler d1 execute deja --remote --command \
  "SELECT u.email, s.period, s.amount FROM usage s JOIN users u ON u.id = s.user_id WHERE s.feature = 'pronunciation' ORDER BY s.period DESC"
```

Dopasuj nazwy kolumn do faktycznego schematu.

**Testy:**
- 401, 403, wygasłe uprawnienie, przekroczony limit użytkownika i limit globalny;
- równoległe inkrementacje `usage` się sumują;
- `/me` nie zwraca wygasłych uprawnień.

## Etap S4 — Ocena wymowy (Azure Pronunciation Assessment), funkcja `pronunciation`

**Co dostajemy dla francuskiego (fr-FR):** ocenę ze zdaniem wzorcowym (scripted):
- dokładność każdego słowa (0–100);
- typ błędu słowa: pominięte, wstawione, źle wymówione;
- wyniki zbiorcze: dokładność, płynność, kompletność.

Według dokumentacji i forum Microsoftu dla fr-FR **nie ma nazw głosek ani sylab**, a ocena intonacji (prosody) i treści jest tylko dla en-US. Zanim zbudujesz UI, zrób jedno testowe wywołanie i zapisz rzeczywistą odpowiedź jako fixture do testów. Jeśli Azure zwraca już więcej (np. głoski), rozszerz UI.

**Przepływ: audio idzie przez naszego Workera, nie bezpośrednio do Azure.** Dzięki temu klucz Azure nigdy nie trafia do przeglądarki, a serwer mierzy dokładny czas nagrania i egzekwuje limity.
1. Front nagrywa (`MediaRecorder`), obcina ciszę na początku i końcu (próg głośności) i konwertuje nagranie do WAV PCM 16 kHz mono przez `OfflineAudioContext`. Na iOS `MediaRecorder` daje `audio/mp4`, więc dekodujemy przez `decodeAudioData`.
2. Limit długości: 15 s na nagranie, egzekwowany po obu stronach.
3. `POST /speech/pronunciation`, chronione przez `requireEntitlement('pronunciation')`:
   - body: WAV i `referenceText` (tekst zdania z treści; serwer akceptuje tylko tekst do 300 znaków);
   - Worker liczy długość z nagłówka WAV i sprawdza oba limity **przed** wysłaniem do Azure;
   - wywołanie Azure Speech REST API for short audio z nagłówkiem `Pronunciation-Assessment` (`ReferenceText`, `GradingSystem: HundredMark`, `Granularity: Word`, `EnableMiscue: true`), `language=fr-FR`;
   - po sukcesie inkrementacja `usage`;
   - odpowiedź znormalizowana do naszego formatu: `{ overall: { accuracy, fluency, completeness, pron }, words: [{ word, accuracy, error: 'none' | 'omission' | 'insertion' | 'mispronunciation' }] }`;
   - audio nie jest zapisywane ani logowane. W logach tylko `user_id`, czas trwania i status.
4. Sekrety: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` przez `wrangler secret`.

**UI:**
- W ćwiczeniach `repeter` i `dire`, po nagraniu, przycisk „Évaluer ma prononciation”. Ocena tylko na żądanie, nigdy automatycznie, bo każda kosztuje.
- Wynik pokazuje zdanie ze słowami podświetlonymi według dokładności (zielony, żółty, czerwony; pominięte przekreślone) i trzy paski: dokładność, płynność, kompletność. Tap w słowo odtwarza je z nagrania wzorcowego. Przy pełnym zdaniu wystarczy odtworzyć całość.
- **Wynik maszyny podpowiada ocenę SRS, ale jej nie narzuca.** Proponowana ocena (np. dokładność ≥ 85 to Good, 70–84 Hard, poniżej 70 Again) jest wstępnie zaznaczona, a użytkownik może ją zmienić.
- Licznik limitu w Réglages → Compte: „Prononciation : 12 / 30 min ce mois-ci”. Przy 429 jasny komunikat, a ćwiczenie dalej działa z samooceną.
- Zgoda: przy pierwszym użyciu krótki ekran informujący, że nagranie trafia do Microsoft Azure w celu oceny i nie jest przechowywane. Zgoda zapisana w ustawieniach konta, do cofnięcia w Réglages.

**Log zdarzeń:** nowy typ `pronunciation` z `{ exerciseId, entryIds, overall, words: [{ word, accuracy, error }] }`, bez audio. Służy do statystyk („słowa, które najczęściej źle wymawiasz”) i odznak. Jest synchronizowany jak reszta.

**Gamifikacja (tylko dla użytkowników z uprawnieniem):**
- Bonus XP +5 za ocenę z dokładnością ≥ 90. Bez kar za niski wynik.
- Odznaki:
  - Accent parisien (10 zdań ≥ 90);
  - Sans faute de prononciation (zdanie 100/100).
- Statystyki: lista najsłabiej wymawianych słów z przyciskiem „Pratiquer”, który buduje sesję `repeter` z zawierających je zdań.

**Testy:**
- normalizacja odpowiedzi Azure na fixture'ach;
- długość WAV liczona z nagłówka;
- przekroczenie 15 s daje 413;
- brak uprawnienia daje 403 bez wywołania Azure (mock fetch);
- limit globalny daje 429 bez wywołania Azure;
- `usage` rośnie tylko po sukcesie.

## Etap P1 — Panel admina

- Uprawnienie `admin`, nadane sobie ręcznie w bazie, tak samo jak w P0.
- **API** (`requireEntitlement('admin')` + sprawdzanie originu):
  - `GET /admin/users?query=` (e-mail, data założenia, ostatnia aktywność, uprawnienia, zużycie w bieżącym miesiącu);
  - `PUT /admin/users/:id/entitlements/:feature` (`{ expiresAt?, note? }`);
  - `DELETE /admin/users/:id/entitlements/:feature`;
  - `GET /admin/usage?period=` (suma globalna i lista top użytkowników).
- **Audyt:** tabela `admin_audit(id, admin_user_id, action, target_user_id, feature, at, payload JSON)`. Każda zmiana uprawnień trafia do audytu, a w panelu jest widok historii.
- **UI:** ekran „Admin” w aplikacji, widoczny tylko z uprawnieniem `admin`:
  - wyszukiwarka użytkowników, przełącznik uprawnień z polem „wygasa” i notatką;
  - wykres zużycia wymowy w miesiącu względem limitu globalnego;
  - wyłącznik `PRONUNCIATION_ENABLED` tylko do odczytu (zmienia się w Cloudflare).
- Wygląd zgodny z `BRANDING.md`, ale prosty, bez gamifikacji.
- **Testy:** 403 dla zwykłego użytkownika, poprawny wpis w audycie przy każdej zmianie, nie da się odebrać `admin` samemu sobie (ochrona przed zablokowaniem się).

## Później
- **Płatności:** `source = 'paddle'` w `entitlements`, webhook Paddle nadaje lub odbiera uprawnienia z `expires_at` zgodnym z okresem subskrypcji. Kod funkcji się nie zmienia, bo opiera się wyłącznie na uprawnieniach (zgodnie z `PLAN.md`, etap 8 „Później”).
- **Dokładniejsza ocena głosek dla francuskiego** (np. SpeechSuper, ma liaisons), jeśli Azure nie wystarczy. Wymaga miesięcznego minimum u dostawcy, więc ma sens dopiero przy płacących użytkownikach.

---

## Poza zakresem tego planu
- **Nagrania lektora** zamiast TTS. Pole `audio.text` i manifest pozwolą podmienić pojedyncze pliki bez zmian w kodzie.
- **Rozumienie dłuższych nagrań** (dialogi, podcasty).
