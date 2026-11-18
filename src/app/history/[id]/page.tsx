import { redirect } from "next/navigation";

/** Debates moved to /d/[id]; keep old links working. */
export default async function LegacyDebatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/d/${id}`);
}
