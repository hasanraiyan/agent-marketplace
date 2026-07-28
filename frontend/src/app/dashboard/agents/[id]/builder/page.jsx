import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

// The builder moved into Agent Studio. Ownership is still enforced by the
// agent API the Studio page calls — this redirect only rewrites the URL.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(studioRoutes.agentBuild(id));
}
