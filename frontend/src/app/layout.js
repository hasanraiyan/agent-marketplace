import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { AxiosTokenProvider } from "@/components/auth/axios-token-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { Analytics } from "@vercel/analytics/next";
import "prismjs/themes/prism.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "persona.hasanraiyan.me — The Premier AI Agent Platform",
  description:
    "Deploy and orchestrate intelligent AI agents for coding, writing, research, and more. persona.hasanraiyan.me is the professional platform for AI-powered productivity.",
  keywords: ["AI agents", "platform", "automation", "productivity", "AI tools"],
  openGraph: {
    title: "persona.hasanraiyan.me — The Premier AI Agent Platform",
    description:
      "Deploy and orchestrate intelligent AI agents. persona.hasanraiyan.me provides professional-grade AI solutions for every workflow.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "var(--clerk-color-primary)",
          colorTextOnPrimaryBackground: "var(--clerk-color-primary-foreground)",
          colorDanger: "var(--clerk-color-danger)",
          colorSuccess: "var(--clerk-color-success)",
          colorWarning: "var(--clerk-color-warning)",
          colorText: "var(--clerk-color-neutral)",
          colorTextSecondary: "var(--clerk-color-muted-foreground)",
          colorBackground: "var(--clerk-color-background)",
          colorInputBackground: "var(--clerk-color-input)",
          colorInputText: "var(--clerk-color-input-foreground)",
          colorShimmer: "var(--clerk-color-shimmer)",
          borderRadius: "var(--clerk-border-radius)",
          spacingUnit: "var(--clerk-spacing)",
        },
        elements: {
          cardBox: "shadow-2xl border border-white/10",
          card: "bg-background/80 backdrop-blur-xl", // Adds glassmorphism to match your vibe
        },
      }}
    >
      <html
        lang="en"
        className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
          >
            <AxiosTokenProvider />
            <TooltipProvider>
              <OnboardingProvider>{children}</OnboardingProvider>
            </TooltipProvider>
            <Toaster />
          </ThemeProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
