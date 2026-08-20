import { apiFetch, apiFetchWithMeta } from "@/lib/api-client";
import { NotificationListItem, PaginatedMeta } from "@/types";

export const notificationService = {
  list: (page = 1, pageSize = 20): Promise<{ notifications: NotificationListItem[]; meta: PaginatedMeta }> =>
    apiFetchWithMeta<NotificationListItem[]>(`/admin/notifications?page=${page}&page_size=${pageSize}`).then(
      ({ data, meta }) => ({ notifications: data, meta: meta as unknown as PaginatedMeta })
    ),

  unreadCount: (): Promise<{ unread_count: number }> => apiFetch<{ unread_count: number }>("/admin/notifications/unread-count"),

  markRead: (notificationId: string): Promise<{ id: string }> =>
    apiFetch<{ id: string }>(`/admin/notifications/${notificationId}/read`, { method: "PATCH" }),
};
