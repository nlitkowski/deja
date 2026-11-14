import { useId } from 'react';

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const labelId = useId();
  return (
    <div className="setting">
      <span className="setting-label" id={labelId}>
        {label}
      </span>
      <div className="pill pill-wide" role="radiogroup" aria-labelledby={labelId}>
        {options.map((o) => (
          <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
