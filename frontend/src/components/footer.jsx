import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  SparklesIcon,
  GlobeIcon,
  MessageCircleIcon,
  UsersIcon,
} from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Enterprise", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Guides", href: "#" },
    { label: "Blog", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Partners", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Cookies", href: "#" },
    { label: "Licenses", href: "#" },
  ],
};

const socialLinks = [
  { icon: GlobeIcon, href: "#", label: "Website" },
  { icon: MessageCircleIcon, href: "#", label: "Community" },
  { icon: UsersIcon, href: "#", label: "Network" },
];

export function Footer() {
  return (
    <footer
      id="footer"
      className="relative border-t border-border/50 bg-background"
    >
      {/* Top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Link Grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <SparklesIcon className="size-4 text-primary" />
              </div>
              <span className="text-base font-semibold">
                Persona<span className="gradient-text">.ai</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The premium platform for AI agents. Deploy and orchestrate
              intelligent agents for any task.
            </p>
            {/* Social Links */}
            <div className="mt-5 flex items-center gap-3">
              {socialLinks.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex size-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                >
                  <s.icon className="size-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10 bg-border/30" />

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Persona.ai. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground/40">
            Built with ❤️ for the AI community
          </p>
        </div>
      </div>
    </footer>
  );
}
