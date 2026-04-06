import React from 'react';
import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Column - Branding/Illustration */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-900 p-12 text-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          {/* Add a simple logo or brand name here */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg">🤖</span>
            </div>
            Agent Marketplace
          </Link>
        </div>

        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">
            Discover the Future of AI.
          </h1>
          <p className="text-zinc-400 text-lg">
            Join the largest marketplace for specialized AI agents. Automate
            workflows, boost productivity, and unlock new possibilities.
          </p>
        </div>

        <div className="text-sm text-zinc-500">
          © {new Date().getFullYear()} Agent Marketplace Inc. All rights
          reserved.
        </div>
      </div>

      {/* Right Column - Auth Forms */}
      <div className="flex items-center justify-center p-8 lg:p-12">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            {/* Show logo on mobile */}
            <div className="lg:hidden flex items-center justify-center lg:justify-start gap-2 mb-6">
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-xl"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-lg">🤖</span>
                </div>
                Agent Marketplace
              </Link>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
