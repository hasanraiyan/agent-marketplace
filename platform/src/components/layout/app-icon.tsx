// Persona brand mark — a blue squircle tile with a white "P" monogram,
// matching the Persona.ai identity (brand blue #1E60FF) used across the
// consumer app. Drawn as a pure inline SVG so it renders identically
// everywhere (no font dependency) and stays crisp at any size.
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Squircle tile */}
      <rect width="32" height="32" rx="7.5" fill="#1E60FF" />
      {/* White "P": semicircular bowl (ring open to the right) */}
      <path
        d="M16.25 20 A6.5 6.5 0 1 0 16.25 7 L16.25 11 A2.5 2.5 0 1 1 16.25 16 Z"
        fill="#FFFFFF"
      />
      {/* White "P": stem with rounded ends */}
      <rect x="18.25" y="7" width="4" height="18" rx="2" fill="#FFFFFF" />
    </svg>
  );
}