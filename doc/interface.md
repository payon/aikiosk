6. interface.md (인터페이스 및 컴포넌트 계약)
TypeScript를 활용한 엄격한 타입 정의로 개발 일관성을 보장합니다.
// types/app.ts
export interface AppRegistry {
  id: string;
  name: string;
  slug: string;
  targetUrl: string;
  iconUrl: string;
  description?: string;
  displayOrder: number;
}

// components/AppGrid.tsx
export interface AppGridProps {
  apps: AppRegistry[];
  onAppClick: (slug: string) => void;
}

// components/ResponsiveSidebar.tsx
export interface ResponsiveSidebarProps {
  apps: AppRegistry[];
  currentSlug: string;
  isMobile: boolean; // useMediaQuery 훅으로 전달
  onToggle: () => void;
}

// hooks/useDeviceType.ts
export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'kiosk';
export function useDeviceType(): DeviceType {
  // window.innerWidth 기반의 디바운싱된 반응형 훅 반환
}
