"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

/**
 * Horizontal scroll rail with mouse-friendly arrow controls. Touch devices
 * already swipe fine, so the arrows only render at md+ — they exist for
 * laptop/desktop, where there's no swipe gesture to scroll a wide row.
 */
export function HScroller({ children, count = 0 }) {
  const railRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [count]);

  const scroll = (direction) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.min(el.clientWidth * 0.8, 400),
      behavior: "smooth",
    });
    setTimeout(update, 350);
  };

  return (
    <div className="relative">
      <div
        ref={railRef}
        onScroll={update}
        className="flex gap-5 overflow-x-auto no-scrollbar py-2 px-0.5 scroll-smooth"
      >
        {children}
      </div>

      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-white to-transparent transition-opacity ${canLeft ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-white to-transparent transition-opacity ${canRight ? "opacity-100" : "opacity-0"}`}
      />

      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className={`hidden md:flex absolute left-1 top-1/2 z-30 size-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:border-[#1E60FF]/30 hover:text-[#1E60FF] ${canLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className={`hidden md:flex absolute right-1 top-1/2 z-30 size-8 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-all hover:border-[#1E60FF]/30 hover:text-[#1E60FF] ${canRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
