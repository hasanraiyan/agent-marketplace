import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

// Persona onboarding runs right after creation, which is a Studio flow now.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(studioRoutes.agentOnboarding(id));
}
