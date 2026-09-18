import { useState } from 'react';
import { Field } from './ui';

/** A short list for common answers, with an explicit custom entry path. */
export function ChoiceField({
  label,
  value,
  options,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [custom, setCustom] = useState(!!value && !options.includes(value));
  return (
    <div>
      <Field label={label}>
        <select
          aria-label={label}
          required={required}
          value={custom ? '__custom' : value}
          onChange={(e) => {
            const other = e.target.value === '__custom';
            setCustom(other);
            onChange(other ? '' : e.target.value);
          }}
        >
          <option value="">Choose an option</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
          <option value="__custom">Other — enter my own</option>
        </select>
      </Field>
      {custom && (
        <div className="setup-choice-custom">
          <Field label={`${label} (custom)`}>
            <input
              required={required}
              value={value}
              placeholder={`Enter ${label.toLowerCase()}`}
              onChange={(e) => onChange(e.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
