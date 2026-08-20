import { apiFetch } from "@/lib/api-client";
import { DashboardStats } from "@/types";

export const dashboardService = {
  getStats: (): Promise<DashboardStats> => apiFetch<DashboardStats>("/admin/dashboard/stats"),
};
