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
  bgType?: string;
  bgColor?: string;
  bgImage?: string;
  links?: { label: string; url: string }[];
}

export interface ShellLayoutProps {
  apps: AppRegistry[];
  currentSlug?: string;
  brand?: string;
  idleMin?: number;
  bodyStyle?: import("react").CSSProperties;
  children: React.ReactNode;
}
