import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.58-5.17 3.58-8.84Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11C3.24 21.3 7.28 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.61H1.26A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function GoogleButton({ onClick, disabled, label = "Continue with Google" }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-11 w-full gap-2.5 rounded-xl border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      <GoogleIcon />
      {label}
    </Button>
  );
}

export function OrDivider({ label = "or" }) {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      <span className="h-px flex-1 bg-zinc-200" />
      {label}
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

export function FieldMessage({ error }) {
  if (!error) return null;
  return (
    <p className="text-xs text-red-600">{error.longMessage ?? error.message}</p>
  );
}

export function AuthField({ id, label, error, ...inputProps }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-zinc-700">
        {label}
      </Label>
      <Input
        id={id}
        className="h-11 rounded-xl border-zinc-200 px-3.5 focus-visible:border-[#1E60FF] focus-visible:ring-[#1E60FF]/20"
        aria-invalid={!!error}
        {...inputProps}
      />
      <FieldMessage error={error} />
    </div>
  );
}

export function GlobalAuthError({ errors }) {
  const err = errors?.global?.[0];
  if (!err) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {err.longMessage ?? err.message}
    </p>
  );
}

export const submitButtonClass =
  "h-11 w-full rounded-xl bg-[#1E60FF] text-sm font-semibold text-white shadow-sm shadow-[#1E60FF]/20 transition-all hover:scale-[1.01] hover:bg-[#154ed0] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100";
