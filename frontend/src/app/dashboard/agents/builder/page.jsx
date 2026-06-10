import { redirect } from "next/navigation";

// Legacy alias of the create flow. The canonical routes are
// /dashboard/agents/create and /dashboard/agents/:id/builder.
export default function Page() {
  redirect("/dashboard/agents/create");
}
