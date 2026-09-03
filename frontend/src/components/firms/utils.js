// Shared display helpers for the Humans & Harness firm surfaces.

export const FIRM_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "health-fitness", label: "Health & Fitness" },
  { value: "mind-behavior", label: "Mind & Behavior" },
  { value: "technology", label: "Technology" },
  { value: "life-relationships", label: "Life & Relationships" },
  { value: "careers", label: "Careers" },
];

export function categoryLabel(value) {
  if (!value) return "Other";
  const hit = FIRM_CATEGORIES.find((c) => c.value === value);
  if (hit) return hit.label;
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatPrice(price) {
  if (!price || typeof price.amount !== "number") return "Custom";
  const currency = price.currency || "USD";
  let formatted;
  try {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price.amount);
  } catch {
    formatted = `${currency} ${price.amount}`;
  }
  return price.period === "monthly" ? `${formatted}/mo` : formatted;
}

export function formatDuration(days) {
  if (!days && days !== 0) return null;
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (days < 60) return weeks === 1 ? "1 week" : `${weeks} weeks`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

export function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export const PROJECT_STATUS = {
  active: {
    label: "Active",
    className: "bg-[#1E60FF]/10 text-[#1E60FF] border-[#1E60FF]/15",
    dot: "bg-[#1E60FF]",
  },
  blocked: {
    label: "Needs you",
    className: "bg-amber-50 text-amber-700 border-amber-200/70",
    dot: "bg-amber-500",
  },
  done: {
    label: "Done",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    dot: "bg-zinc-400",
  },
};

export const DELIVERABLE_STATUS = {
  pending: {
    label: "Pending",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
    dot: "bg-zinc-400",
  },
  in_progress: {
    label: "In progress",
    className: "bg-[#1E60FF]/10 text-[#1E60FF] border-[#1E60FF]/15",
    dot: "bg-[#1E60FF]",
  },
  delivered: {
    label: "Delivered",
    className: "bg-violet-50 text-violet-700 border-violet-200/70",
    dot: "bg-violet-500",
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500",
  },
};

export function idOf(ref) {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return ref._id || ref.id || null;
}

export function apiError(err, fallback) {
  return err?.response?.data?.message || fallback;
}
