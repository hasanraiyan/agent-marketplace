import Link from "next/link";

const productLinks = [
  { label: "Discover", href: "/dashboard" },
  { label: "Agent Studio", href: "/studio" },
  { label: "Developer Platform", href: "/developer" },
];

export function Footer() {
  return (
    <footer id="footer" className="relative border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#1E60FF]" />
              <span className="font-display text-base font-semibold tracking-tight text-zinc-900">
                Persona<span className="text-zinc-400">.ai</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">
              An index of AI minds you can talk to, build, or embed in your
              own product.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="mb-3 font-mono text-xs tracking-wider text-zinc-400 uppercase">
              Product
            </h3>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-600 transition-colors hover:text-zinc-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-8 sm:flex-row">
          <p className="text-xs text-zinc-400">
            &copy; {new Date().getFullYear()} Persona.ai
          </p>
        </div>
      </div>
    </footer>
  );
}
