import { Link } from 'react-router-dom';
import { Globe, X, Users } from 'lucide-react';
import { footerLinks } from '@/data/mockData';

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl mb-4">
              <span className="text-primary">Agent</span>
              <span>Marketplace</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6">
              Discover, build, and deploy AI agents for any use case.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Globe className="h-5 w-5" />
                <span className="sr-only">Website</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
                <span className="sr-only">X (Twitter)</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Users className="h-5 w-5" />
                <span className="sr-only">Community</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
                <span className="sr-only">X (Twitter)</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Users className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
