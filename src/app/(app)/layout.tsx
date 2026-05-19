import { AppShell } from "@/components/app-shell";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell profile={null}>{children}</AppShell>;
}
