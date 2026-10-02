# 원본 HTML 기반 완성 화면 템플릿

## 현재 제공 범위

`doc/index2.html`의 메가MGC커피 주문 화면을 관리자 갤러리의 **메가MGC커피 · 완성 화면**으로 제공한다. 화면의 DOM, 배치, 상품 그림, 카테고리, 옵션 모달, 장바구니, 연습 결제, 영수증, 세로·가로 전환을 원본 흐름으로 사용한다. 카테고리 6개와 상품 42개가 포함된다.

관리자는 **관리 → 템플릿 갤러리 → 메가MGC커피 · 완성 화면 → 불러오기** 후 화면 요소 `CustomHTML`을 선택한다. 오른쪽 **완성 화면 수정**에서 브랜드명, 지점명, 대표 색, 첫 화면 방향, 카테고리 이름, 각 상품 이름·가격·표시 여부를 바꿀 수 있다. **▶ 미리보기**에서 주문 흐름을 확인한 뒤 **새 템플릿으로 저장**으로 원본과 분리된 사본을 만든다. 저장한 JSON에는 원본 HTML과 변경값이 들어가므로 키오스크도 같은 화면을 렌더링한다.

관리자 로그인 없이 화면을 확인할 때는 `http://localhost:5173/?experience=1&app=mega_html_exact`를 연다.

## 구현 구조

- `doc/index2.html`: 사용자가 제공한 화면 원본. 하단 결제 바의 너비 충돌을 수정했다.
- `doc/mega_clone_runtime.js`: 원본 실행 코드를 정적 자산으로 분리했다. 상품·카테고리 설정은 HTML의 비실행 `template#clone-data`에서 읽는다.
- `doc/fonts/`: Black Han Sans와 Noto Sans KR 오프라인 글꼴, 각 OFL 라이선스.
- `admin_editor/src/editor/gallery/mega_exact.ts`: 갤러리 항목과 기본 설정.
- `admin_editor/src/editor/panels/CloneSettings.tsx`: 관리자 제한 수정 폼.
- `kiosk_app/src/kiosk/cloneHtml.ts`: 원본 HTML에 수정값, 앱 내부 스크립트·글꼴 경로를 적용.
- `kiosk_app/src/kiosk/TemplateRenderer.tsx`: Tauri 키오스크와 관리자 미리보기에서 공통으로 쓰는 iframe 렌더러.

iframe에는 `allow-scripts`만 허용한다. 원본 HTML의 인라인 실행 코드를 앱 내부 스크립트로 분리하여 Tauri의 스크립트 CSP는 유지하고, 격리 iframe에서 오프라인 글꼴을 읽도록 `font-src 'self' data:`만 추가했다. 글꼴 데이터는 클론 화면을 열 때 별도 번들에서 불러온다. 결제는 교육용 시뮬레이션이며 실제 결제 단말기와 연결되지 않는다.

## 검증

`npm --prefix admin_editor run build`, `npm --prefix kiosk_app run build` 통과. `scripts/test-mega-clone.cjs`는 상품 선택, 수량, 장바구니, 결제, 영수증, 초기화, 방향 전환을 확인하며 `STRICT_CSP=1`에서 기존 Tauri CSP 조건을 적용해 실행할 수 있다. `scripts/test-mega-clone-editor.cjs`는 독립 관리자 DB에서 설정 수정, 미리보기, 새 사본 저장·조회·삭제를 확인한다.

다른 업종의 첨부 자료는 스크린샷이며 완성 HTML은 `index2.html` 하나다. 다른 앱을 이 수준으로 제공하려면 해당 앱 화면과 상호작용을 각각 원본 HTML 수준으로 제작해야 한다.
