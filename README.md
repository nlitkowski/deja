# Déjà

Révisions de français A1–A2. Spaced repetition to kontrolowane déjà vu.

Aplikacja do powtórek z francuskiego (A1–A2) z powtórkami rozłożonymi w czasie (SRS): ćwiczenia z wpisywaniem odpowiedzi, fiszki z gramatyką, słownictwem i zwrotami według podręcznika Édito (Didier), interfejs po francusku, pomoc po polsku albo francusku. Działa w przeglądarce i offline (PWA). Postęp zostaje na urządzeniu; konto Google jest opcjonalne.

Projekt prywatny do nauki, bez związku z Éditions Didier. Édito jest znakiem towarowym Éditions Didier. Fiszki i ćwiczenia to autorskie teksty, które trzymają się tylko zakresu tematów z podręcznika.

## Adresy

| | Adres | Hosting |
|---|---|---|
| Aplikacja | https://deja.litkowski.com | GitHub Pages (korzeń `/`) |
| API | https://deja-api.litkowski.com | Cloudflare Worker `deja` + D1 |

## Uruchomienie

```bash
npm install
npm run dev       # aplikacja na :5173
npm run dev:api   # API na :8787 (lokalne D1); bez niego karta „Compte” jest ukryta
npm run test      # testy, w tym walidacja wszystkich pakietów treści i Workera
npm run build     # typecheck + testy + build do dist/
```

Adres API aplikacja bierze z `VITE_API_URL` (w dev z `.env.development`). Sekret Google do lokalnego API: skopiuj `.dev.vars.example` do `.dev.vars` i uzupełnij.

Treści są w `content/` (format: `content/_template/README.md`), szczegóły projektu w `CLAUDE.md`, identyfikacja wizualna i język w `BRANDING.md`.

## Publikacja

Workflow `.github/workflows/deploy.yml` przy każdym pushu na `main`:

- **check**: lint i testy (aplikacja, Worker, walidacja pakietów treści). Oba deploye czekają na ten job, więc nieudany check niczego nie publikuje.
- **api**: migracje D1, `wrangler deploy` na `deja-api.litkowski.com` (sekrety repo: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Staging ręcznie: Actions → Deploy → Run workflow → `staging`.
- **pages**: build z `BASE_PATH=/` i `VITE_API_URL=https://deja-api.litkowski.com`, publikacja na GitHub Pages. Domenę `deja.litkowski.com` ustawia się w **Settings → Pages → Custom domain** (przy publikacji z GitHub Actions plik `public/CNAME` jest tylko informacyjny), a w DNS Cloudflare: `CNAME deja → nlitkowski.github.io`, bez proxy (szara chmurka).

### Smoke test po deployu

```bash
curl https://deja-api.litkowski.com/health
```
Oczekiwane: `200` i `{"ok":true}`.

```bash
curl -i -X OPTIONS https://deja-api.litkowski.com/sync/pull -H "Origin: https://deja.litkowski.com" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: authorization"
```
Oczekiwane: `204` oraz `Access-Control-Allow-Origin: https://deja.litkowski.com`, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers` z `Authorization`.

W przeglądarce:
- https://deja.litkowski.com się ładuje, a Réglages pokazują kartę „Compte”.
- Aplikację da się zainstalować (PWA) i manifest ma `scope` oraz `start_url` równe `/`.
- Po pierwszym wejściu działa offline: w DevTools → Network → Offline odśwież stronę i przejdź sesję powtórki.

## Nagrania

Pliki MP3 generuje `npm run tts` (TTS Azure, opis w `scripts/tts.ts`) do bucketu R2 `deja-audio`, serwowanego pod `https://deja-audio.litkowski.com`. Nazwa pliku to hash tekstu i głosu, więc plik nigdy się nie zmienia (`Cache-Control: public, max-age=31536000, immutable`). Aplikacja trzyma pobrane pliki w Cache API.

Ustawienia w panelu Cloudflare (strefa `litkowski.com`, host `deja-audio.litkowski.com`):

1. **Cache Rule** „audio: cache everything”: Hostname equals `deja-audio.litkowski.com` → Eligible for cache, Edge TTL 1 miesiąc (ignoruj Cache-Control), Browser TTL: respect origin.
2. **Transform Rule** (Modify response header) dla tego hosta: set static `Access-Control-Allow-Origin: *`. Polityka CORS bucketu dodaje nagłówek tylko do żądań z `Origin`, a brzeg mógłby zapisać w cache odpowiedź bez niego. Pliki są publiczne i bez ciasteczek, więc `*` jest bezpieczne.
3. **Rate limiting** dla tego hosta, np. 300 żądań na minutę z jednego IP → block na minutę. Pobieranie audio pakietu w aplikacji idzie po 4 pliki naraz, a po `429` czeka coraz dłużej (1 s, 2 s, 4 s… do 30 s) i wznawia od miejsca przerwy.
4. **Alert zużycia** R2 (operacje klasy B i miejsce): Notifications → Billing.

Sprawdzenie (dwa razy, za drugim razem `cf-cache-status: HIT` i `access-control-allow-origin: *`):

```bash
curl -sI https://deja-audio.litkowski.com/5cb37b5836b06d2a0e6c94f2d872b973.mp3
```

`npm run tts -- --prune --yes` usuwa z R2 nagrania, których treść już nie używa, i czyści je z cache brzegu, jeśli w `.dev.vars` są `CLOUDFLARE_ZONE_ID` i `CLOUDFLARE_PURGE_TOKEN` (token z uprawnieniem Zone → Cache Purge). Bez nich wypisuje adresy do wyczyszczenia ręcznie. Przy dodawaniu plików purge nie jest potrzebny, bo nowe pliki mają nowe nazwy.

## Przeniesienie postępu

Dane w przeglądarce są osobne dla każdego adresu. Postęp z innego adresu przenosi się plikiem: Réglages → „Sauvegarde” → **Exporter** na starym adresie, **Importer un fichier** na nowym. Import scala zdarzenia po `id`, więc powtórzony import niczego nie dubluje.
