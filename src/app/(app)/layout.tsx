import { AppShell } from "@/components/app-shell";
import { getViewerContext } from "@/lib/data";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await getViewerContext();

  return <AppShell profile={profile!}>{children}</AppShell>;
}
