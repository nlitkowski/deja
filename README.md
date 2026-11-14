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

- **api**: lint, testy, migracje D1, `wrangler deploy` na `deja-api.litkowski.com` (sekrety repo: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Staging ręcznie: Actions → Deploy → Run workflow → `staging`.
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

## Przeniesienie postępu

Dane w przeglądarce są osobne dla każdego adresu. Postęp z innego adresu przenosi się plikiem: Réglages → „Sauvegarde” → **Exporter** na starym adresie, **Importer un fichier** na nowym. Import scala zdarzenia po `id`, więc powtórzony import niczego nie dubluje.
