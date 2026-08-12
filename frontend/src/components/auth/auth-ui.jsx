import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const CARD_CLASS =
  "w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export function LoadingCard() {
  return (
    <div className={`${CARD_CLASS} flex items-center justify-center py-16`}>
      <Loader2 className="size-6 animate-spin text-[#1E60FF]" />
    </div>
  );
}

/** One button per OAuth strategy Clerk actually reports as enabled — icon
 * and label come straight from Clerk's own environment response, so a new
 * provider connected in the dashboard shows up without a code change. */
export function SocialButton({ provider, onClick, disabled }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-11 w-full gap-2.5 rounded-xl border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      {provider.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={provider.logoUrl} alt="" className="size-4" />
      )}
      Continue with {provider.name}
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
