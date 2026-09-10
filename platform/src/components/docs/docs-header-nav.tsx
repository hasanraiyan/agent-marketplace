"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DocsHeaderNav() {
  const pathname = usePathname();

  const links = [
    { label: "React", href: "/docs/react/v0.8.1", prefix: "/docs/react" },
    { label: "SDK", href: "/docs/sdk/v0.7.5", prefix: "/docs/sdk" },
    { label: "Runtime", href: "/docs/runtime/v0.9.5", prefix: "/docs/runtime" },
    { label: "Adapters", href: "/docs/adapters/v0.1.0", prefix: "/docs/adapters" },
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const isActive = pathname.startsWith(link.prefix);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              isActive
                ? "bg-blue-600 text-white font-medium shadow-xs"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
