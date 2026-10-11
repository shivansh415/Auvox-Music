"use client";

import { useId, type CSSProperties } from "react";
import clsx from "clsx";

/* Form atoms shared by /enroll and /payment: underline inputs with floating labels, sliding chips. */

export type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  textarea?: boolean;
  type?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  autoComplete?: string;
  maxLength?: number;
  /** an element pinned to the right of the input (brand badge on the card number) */
  trailing?: React.ReactNode;
  className?: string;
};

/** underline input with a floating label */
export function Field({ id, label, value, onChange, onFocus, onBlur, error, hint, textarea, type = "text", inputMode, autoComplete, maxLength, trailing, className }: FieldProps) {
  const describe = useId();
  const shared = {
    id,
    value,
    placeholder: " ",
    className: "en-input",
    "aria-invalid": !!error || undefined,
    "aria-describedby": error || hint ? describe : undefined,
    autoComplete,
    maxLength,
    onFocus,
    onBlur,
  };
  return (
    <div className={clsx("en-row en-field", error && "is-error", className)}>
      {textarea ? (
        <textarea {...shared} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...shared} type={type} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
      )}
      <label htmlFor={id} className="en-label">
        {label}
      </label>
      <span className="en-line" aria-hidden />
      {trailing && <span className="en-trailing">{trailing}</span>}
      {(error || hint) && (
        <p id={describe} className={clsx("mt-2 text-[0.78rem]", error ? "text-red" : "text-ink/50")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** a single-select row of chips; the ink highlight slides to the chosen one */
export function Chips({ id, label, options, value, onChange, error }: { id: string; label: string; options: readonly string[]; value: string; onChange: (v: string) => void; error?: string }) {
  const index = options.indexOf(value);
  const style = { "--n": options.length, "--i": Math.max(index, 0), "--hl": index < 0 ? 0 : 1 } as CSSProperties;
  return (
    <div className="en-row pt-5">
      <span id={`${id}-label`} className="en-legend">
        {label}
      </span>
      <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} className={clsx("en-chips mt-3", error && "is-error")} style={style}>
        <span className="en-chip-hl" aria-hidden />
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} data-on={o === value ? "1" : "0"} onClick={() => onChange(o)} className="en-chip">
            {o}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[0.78rem] text-red">{error}</p>}
    </div>
  );
}
