3. uiux.md (UI/UX 디자인 가이드라인)
3.1. 디자인 철학
톤 앤 매너: 따뜻하고 풍부한 컬러 팔레트(Warm & Rich), 자연스러운 조명감, 고급스러운 오픈소스 테크 브랜드의 세련됨.
기본 방향: 세로형(Portrait) 우선. 키오스크와 모바일 사용성을 최우선으로 하며, 가로형은 이를 자연스럽게 확장하는 형태로 설계.
3.2. 반응형 브레이크포인트 및 그리드 시스템
디바이스 유형
해상도 범위
그리드 열(Column)
아이콘 카드 비율
폰트 크기 (Base)
Mobile
< 768px
2열
4:5
clamp(14px, 2vw, 16px)
Tablet
768px ~ 1024px
3열
4:5
clamp(16px, 2.5vw, 18px)
Desktop
1025px ~ 1440px
4열
4:5
clamp(16px, 1.5vw, 18px)
Large Desktop
1441px ~ 1920px
4열 (중앙 정렬, 최대 폭 제한)
4:5
clamp(18px, 1.2vw, 20px)
Kiosk (21"~32")
1080x1920 (Portrait)
3열 또는 4열
4:5
clamp(24px, 2vw, 32px)
Kiosk (43"~55")
2160x3840 (4K Portrait)
4열 또는 5열
4:5
clamp(32px, 1.5vw, 48px)
3.3. 관리자 대시보드 UI 규칙
Desktop: 좌측 고정 사이드바 (폭 280px). 메뉴 아이템은 아이콘 + 텍스트 조합.
Tablet: 접을 수 있는(Collapsible) 사이드바 (폭 80px, 아이콘만 표시).
Mobile: 좌측 사이드바 제거. 우측 하단 고정 FAB(+) 또는 상단 햄버거 메뉴를 통한 드로어(Drawer) 방식. 하단 고정 탭 바(Bottom Tab Bar)로 주요 메뉴(대시보드, 앱 관리, 설정) 제공.
3.4. 인터랙션 및 애니메이션
아이콘 호버 시: 부드러운 스케일 업(scale-105) 및 그림자 강화 (Framer Motion).
페이지 전환 시: AnimatePresence를 활용한 200ms 페이드 인/아웃.
키오스크 터치 최적화: 모든 클릭 타겟(버튼, 아이콘)의 최소 크기를 48x48px (또는 48x48dp) 이상으로 보장하여 오탐지 방지.
