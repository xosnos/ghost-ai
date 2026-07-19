export interface Project {
  id: string;
  name: string;
  slug: string;
  owner: boolean;
}

export const mockProjects: Project[] = [
  { id: "p1", name: "Payments Service", slug: "payments-service", owner: true },
  { id: "p2", name: "Auth Gateway", slug: "auth-gateway", owner: true },
  { id: "p3", name: "Notifications Platform", slug: "notifications-platform", owner: true },
  { id: "s1", name: "Search Infrastructure", slug: "search-infrastructure", owner: false },
  { id: "s2", name: "Data Warehouse", slug: "data-warehouse", owner: false },
];
