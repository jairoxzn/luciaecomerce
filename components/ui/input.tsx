import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm text-ink placeholder:text-neutral-400 transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:bg-mist disabled:text-stone aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, "h-11", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, "min-h-24 py-3", className)} {...props} />;
});

const CHEVRON =
  "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(field, "h-11 appearance-none pr-10", CHEVRON, className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

/** Campo con etiqueta + error. Asocia <label> con el control (htmlFor/id) y expone el error con aria-describedby. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  const autoId = React.useId();
  const only = React.isValidElement(children) ? (children as React.ReactElement<{ id?: string }>) : null;
  const id = only?.props.id ?? autoId;
  const control = only ? React.cloneElement(only as React.ReactElement<Record<string, unknown>>, { id, "aria-describedby": error ? `${id}-err` : undefined }) : children;
  return (
    <div className={className}>
      <Label htmlFor={only ? id : undefined}>{label}</Label>
      {control}
      {hint && !error && <p className="mt-1.5 text-xs text-stone">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-3 text-sm", disabled && "cursor-not-allowed opacity-50")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-neutral-300")}
      >
        <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
      {label && <span>{label}</span>}
    </div>
  );
}
