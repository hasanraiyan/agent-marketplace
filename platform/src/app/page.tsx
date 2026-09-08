import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Persona — developer platform for AI agents",
  description:
    "Create a Project on Persona’s agent infrastructure, build agents by conversation, wire them to your skills, knowledge, and tools, then call them from your own app via the SDKs or REST API.",
};

export default function RootPage() {
  return <LandingPage />;
}
