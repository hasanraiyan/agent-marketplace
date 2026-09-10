import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Persona — Describe an agent, ship it into your product",
  description:
    "Persona is where you build AI agents by describing them in plain English or code, connect them to real tools and data, test them live, and call the finished agent from your own app with an SDK, a server adapter, or a drop-in chat component.",
};

export default function RootPage() {
  return <LandingPage />;
}
