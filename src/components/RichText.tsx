import { Fragment } from 'react';

/** Renders `**bold**` and line breaks; content files use nothing else. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split('**').map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : <Fragment key={j}>{part}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}
