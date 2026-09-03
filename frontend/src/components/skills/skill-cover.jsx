"use client";

import { cn } from "@/lib/utils";

/**
 * SkillCover — the "album art" for a published skill.
 *
 * Uses the creator's uploaded cover when present; otherwise renders the
 * landing-page "mind card" treatment: a category-tinted gradient, a mono
 * eyebrow (SKILL — CATEGORY) and the title in the display face, with the
 * persona's avatar ghosted in the corner so every card still carries a face.
 */

const CATEGORY_LABEL = {
  entrepreneurship: "Entrepreneurship",
  "health-fitness": "Health & Fitness",
  "mind-behavior": "Mind & Behavior",
  technology: "Technology",
  "life-relationships": "Life & Relationships",
  careers: "Careers",
  other: "General",
};

// Gradient pairs per category. Default is the brand blue used on the landing cards.
const CATEGORY_GRADIENT = {
  entrepreneurship: ["#1E60FF", "#0B2C8A"],
  "health-fitness": ["#16A34A", "#0B4B22"],
  "mind-behavior": ["#7C3AED", "#3B1580"],
  technology: ["#EA580C", "#7A2A05"],
  "life-relationships": ["#DB2777", "#6B0F3A"],
  careers: ["#0891B2", "#0A3E50"],
  other: ["#1E60FF", "#0B2C8A"],
};

export function skillCategoryLabel(category) {
  return CATEGORY_LABEL[category] || CATEGORY_LABEL.other;
}

export function SkillCover({
  skill,
  persona,
  className,
  size = "md", // sm | md | lg — controls type scale only; layout is via className
  showTitle = true,
}) {
  const title = skill?.title || skill?.name || "Untitled skill";
  const category = skill?.category || "other";
  const [from, to] = CATEGORY_GRADIENT[category] || CATEGORY_GRADIENT.other;
  const avatar = persona?.avatarUrl || skill?.persona?.avatarUrl;

  if (skill?.coverImage) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-zinc-100 select-none",
          className,
        )}
      >
        <img
          src={skill.coverImage}
          alt={title}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }

  const eyebrow =
    size === "sm" ? "text-[8px]" : size === "lg" ? "text-[11px]" : "text-[9px]";
  const heading =
    size === "sm"
      ? "text-[13px] leading-snug"
      : size === "lg"
        ? "text-2xl sm:text-3xl leading-tight"
        : "text-base sm:text-lg leading-snug";

  return (
    <div
      className={cn("relative overflow-hidden select-none", className)}
      style={{
        backgroundImage: `linear-gradient(160deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      {/* subtle texture */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, white 0, transparent 45%), radial-gradient(circle at 85% 90%, white 0, transparent 40%)",
        }}
      />
      {avatar ? (
        <img
          src={avatar}
          alt=""
          aria-hidden
          className="absolute -right-3 -bottom-3 size-[58%] rounded-full object-cover opacity-30 mix-blend-luminosity"
        />
      ) : null}
      {showTitle ? (
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 text-white">
          <p
            className={cn(
              "font-mono uppercase tracking-[0.18em] text-white/70 mb-1",
              eyebrow,
            )}
          >
            Skill — {skillCategoryLabel(category)}
          </p>
          <h3 className={cn("font-display font-semibold tracking-tight", heading)}>
            {title}
          </h3>
        </div>
      ) : null}
    </div>
  );
}
