import { redirect } from "next/navigation";
import { studioRoutes } from "@/lib/studio-routes";

// Agent creation moved into Agent Studio. Kept as a redirect so existing
// links, bookmarks, and docs keep working.
export default function Page() {
  redirect(studioRoutes.agentNew);
}
