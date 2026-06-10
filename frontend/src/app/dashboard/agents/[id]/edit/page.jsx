import { redirect } from "next/navigation";

// Legacy alias of the builder. The canonical edit route is
// /dashboard/agents/:id/builder.
export default async function Page({ params }) {
  const { id } = await params;
  redirect(`/dashboard/agents/${id}/builder`);
}
