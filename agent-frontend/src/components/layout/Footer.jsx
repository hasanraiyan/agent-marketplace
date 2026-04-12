// Footer.tsx
import { Link } from 'react-router-dom';
import { Globe, Users, X } from 'lucide-react';
import { footerLinks } from '@/data/mockData';

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="text-primary">Agent</span>
              <span>Marketplace</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Discover, build, and deploy AI agents for any use case.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Globe className="size-5" />
                <span className="sr-only">Website</span>
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <X className="size-5" />
                <span className="sr-only">X (Twitter)</span>
              </a>
              <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Users className="size-5" />
                <span className="sr-only">Community</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">Product</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">Resources</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">Company</h3>
            <ul className="flex flex-col gap-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="font-semibold">Legal</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Agent Marketplace. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with React, Vite, and shadcn/ui
          </p>
        </div>
      </div>
    </footer>
  );
}