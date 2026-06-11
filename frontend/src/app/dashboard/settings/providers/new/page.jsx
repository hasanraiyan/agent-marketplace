"use client";

import ProviderEditorPage from "../[id]/edit/page";

export default function NewProviderPage() {
  return <ProviderEditorPage params={Promise.resolve({ id: "new" })} />;
}
