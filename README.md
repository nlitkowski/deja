# Déjà

Révisions de français A1–A2. Spaced repetition to kontrolowane déjà vu.

Aplikacja do powtórek z francuskiego (A1–A2) z powtórkami rozłożonymi w czasie (SRS): ćwiczenia z wpisywaniem odpowiedzi, fiszki z gramatyką, słownictwem i zwrotami według podręcznika Édito (Didier), interfejs po francusku, pomoc po polsku albo francusku. Działa w przeglądarce, bez kont i bez backendu: postęp zostaje w `localStorage` danego urządzenia.

Projekt prywatny do nauki, bez związku z Éditions Didier. Édito jest znakiem towarowym Éditions Didier. Fiszki i ćwiczenia to autorskie teksty, które trzymają się tylko zakresu tematów z podręcznika.

## Uruchomienie

```bash
npm install
npm run dev     # serwer deweloperski
npm run test    # testy, w tym walidacja wszystkich pakietów treści
npm run build   # typecheck + testy + build do dist/
```

Treści są w `content/` (format: `content/_template/README.md`), szczegóły projektu w `CLAUDE.md`, identyfikacja wizualna i język w `BRANDING.md`.

## Publikacja na GitHub Pages

Workflow `.github/workflows/deploy.yml` buduje i publikuje aplikację przy każdym pushu na `main`. Jednorazowo trzeba zrobić dwie rzeczy:

1. W repozytorium na GitHubie otwórz **Settings → Pages** i w **Build and deployment → Source** wybierz **GitHub Actions**.
2. Wypchnij `main`. Aplikacja będzie pod adresem `https://<użytkownik>.github.io/deja/`.

Darmowe konto pozwala publikować Pages tylko z publicznego repozytorium, a sama strona jest publiczna dla każdego, kto zna adres.
