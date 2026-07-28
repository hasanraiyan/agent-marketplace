import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

// Legacy alias of the builder, which now lives in Agent Studio.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(studioRoutes.agentBuild(id));
}
