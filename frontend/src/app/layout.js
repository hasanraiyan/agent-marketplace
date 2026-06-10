import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { AxiosTokenProvider } from "@/components/auth/axios-token-provider";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Persona.ai — The Premier AI Agent Platform",
  description:
    "Deploy and orchestrate intelligent AI agents for coding, writing, research, and more. Persona.ai is the professional platform for AI-powered productivity.",
  keywords: ["AI agents", "platform", "automation", "productivity", "AI tools"],
  openGraph: {
    title: "Persona.ai — The Premier AI Agent Platform",
    description:
      "Deploy and orchestrate intelligent AI agents. Persona.ai provides professional-grade AI solutions for every workflow.",
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col bg-background text-foreground">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AxiosTokenProvider />
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
