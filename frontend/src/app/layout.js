import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Persona.ai — The AI Agent Marketplace",
  description:
    "Discover, deploy, and orchestrate intelligent AI agents for coding, writing, research, and more. The premium marketplace for AI-powered productivity.",
  keywords: [
    "AI agents",
    "marketplace",
    "automation",
    "productivity",
    "AI tools",
  ],
  openGraph: {
    title: "Persona.ai — The AI Agent Marketplace",
    description:
      "Discover, deploy, and orchestrate intelligent AI agents for coding, writing, research, and more.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
