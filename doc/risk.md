8. risk.md (리스크 및 완화 전략)
리스크 항목
영향도
상세 완화 전략 (Mitigation)
기존 앱의 절대 경로(CSS/JS) 깨짐
상
기존 앱의 next.config.js에 assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX를 설정하여, 코어 플랫폼에 임베디드될 때 정적 자산 경로를 상대적으로 또는 프록시 경로로 강제 변환.
키오스크 환경의 터치 지연 및 폰트 가독성
상
CSS touch-action: manipulation 적용으로 더블탭 줌 방지. 모든 텍스트에 clamp() 함수를 사용하여 55인치(4K)에서도 물리적 크기(cm) 기준 가독성 확보.
모바일에서 사이드바 공간 부족
중
uiux.md 규칙에 따라 모바일(<768px)에서는 사이드바를 완전히 숨기고, 하단 고정 탭 바(Bottom Tab Bar)와 상단 햄버거 드로어로 UI 패러다임을 전환.
CORS 및 서드파티 쿠키 차단
상
iframe을 사용하지 않고 Next.js Middleware Rewrite를 사용하므로, 브라우저는 모든 요청을 rustkorea.cloud의 단일 출처(Same-Origin)로 인식하여 CORS 및 쿠키 차단 문제가 원천적으로 발생하지 않음.
