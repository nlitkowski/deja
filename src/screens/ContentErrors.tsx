import type { LoadIssue } from '../content/loader';

/** Dev-only screen for content authors; messages come from the loader. */
export function ContentErrors({ issues }: { issues: LoadIssue[] }) {
  return (
    <main className="screen content-errors" lang="pl">
      <h1>Błędy w pakietach treści</h1>
      <p>Popraw poniższe pola i zapisz plik. Strona przeładuje się sama.</p>
      <ul>
        {issues.map((i, n) => (
          <li key={n}>
            <code>{i.file}</code>
            <br />
            <strong>{i.path}</strong>: {i.message}
          </li>
        ))}
      </ul>
    </main>
  );
}
