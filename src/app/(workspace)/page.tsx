import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireUser } from "@/lib/auth/current-user";
import { listDocuments } from "@/server/documents";

export const metadata: Metadata = { title: "Documents" };

export default async function DashboardPage() {
  const user = await requireUser();
  const documents = await listDocuments(user);
  return <Dashboard user={{ name: user.name, email: user.email }} documents={documents} />;
}
