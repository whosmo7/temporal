import { useId, type InputHTMLAttributes, type Ref } from 'react';

export function TextInput({
  label,
  hint,
  error,
  ref,
  id,
  ...rest
}: {
  label: string;
  hint?: string;
  /** Shown under the field, replacing the hint, and marks the field invalid. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className="kit-field">
      <label className="kit-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className="kit-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...rest}
      />
      {note && (
        <span id={noteId} className={error ? 'kit-field__error' : 'kit-field__hint'} role={error ? 'alert' : undefined}>
          {note}
        </span>
      )}
    </div>
  );
}
