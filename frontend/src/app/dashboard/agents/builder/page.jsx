import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

// Legacy alias of the create flow, which now lives in Agent Studio.
export default function Page() {
  redirect(studioRoutes.agentNew);
}
