export interface AppRegistry {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  iconUrl: string;
  description?: string;
  displayOrder: number;
  category?: string;
  stripPrefix?: boolean;
  openMode?: "embed" | "direct";
}

export interface ShellLayoutProps {
  apps: AppRegistry[];
  currentSlug?: string;
  brand?: string;
  idleMin?: number;
  children: React.ReactNode;
}
