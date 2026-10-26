import { requireAdmin } from "@/server/session";
import { AdminNav } from "./admin-nav";

/** Toda a área /admin exige papel ADMIN (verificado no servidor; usuários comuns recebem 404). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      {children}
    </div>
  );
}
