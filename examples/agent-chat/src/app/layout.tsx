import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersonaProvider } from "@personaai/adapters/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Persona Agent Chat — Full AG-UI & MCP Example",
  description:
    "Production-grade AI agent chat interface powered by @personaai/adapters and @personaai/react with AG-UI streaming, tool cards, and MCP Ext Apps.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PersonaProvider baseUrl="/api/persona">
          <TooltipProvider>{children}</TooltipProvider>
        </PersonaProvider>
      </body>
    </html>
  );
}
