import { redirect } from "next/navigation";

// `/admin` has no page of its own — the dashboard at `/admin/dashboard`
// already renders the full StatCard grid via dashboard-service. Redirecting
// here (rather than duplicating that page) keeps a single source of truth
// for the admin landing content while still avoiding a 404 on `/admin`.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
