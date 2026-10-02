import { NextRequest, NextResponse } from "next/server";

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "169.254.169.254", "0.0.0.0"];
const DEFAULT_ALLOWED = (process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "example.local")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BACKEND = process.env.API_INTERNAL_URL || "http://127.0.0.1:4501";

export function isAllowedTarget(targetUrl: string, allowlist: string[]): boolean {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return false;
  }
  // 개발용 로컬 서브앱 허용 (운영 ALLOW_LOCAL_APPS=false 필수)
  const allowLocal = process.env.ALLOW_LOCAL_APPS
    ? process.env.ALLOW_LOCAL_APPS === "true"
    : process.env.NODE_ENV !== "production";
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1") return allowLocal;
  if (u.protocol !== "https:") return false;
  if (BLOCKED_HOSTS.includes(u.hostname)) return false;
  return allowlist.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
}

export function resolveAppSlug(pathname: string): { slug: string; rest: string } | null {
  const m = pathname.match(/^\/apps\/([^/]+)(\/(.*))?$/);
  if (!m) return null;
  return { slug: m[1], rest: m[3] ?? "" };
}

// architect.md 1.2: 서브앱은 basePath('/apps/<slug>')로 동작하므로,
// rewrite 시 /apps/<slug> 접두사를 보존한다.
// targetUrl 자체에 경로가 있으면(예: /subapps/library) 그 경로를 기준으로 붙인다.
// stripPrefix=true: 상대가 basePath 없이 루트로 서빙 → /apps/<slug> 제거 후 그대로 전달.
export function buildRewriteDest(targetBase: string, slug: string, rest: string, search: string, strip = false): string {
  const base = new URL(targetBase);
  if (strip) {
    base.pathname = rest ? `/${rest}` : "/";
    base.search = search;
    return base.toString();
  }
  const basePath = base.pathname.replace(/\/$/, "");
  base.pathname = basePath
    ? rest ? `${basePath}/${rest}` : `${basePath}/`
    : `/apps/${slug}${rest ? `/${rest}` : ""}`;
  base.search = search;
  return base.toString();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/apps/")) return NextResponse.next();

  const found = resolveAppSlug(pathname);
  if (!found) return NextResponse.next();

  // 레지스트리는 백엔드(API 서버)에서 조회 — 프론트는 DB를 직접 읽지 않는다.
  // 등록 시점에 백엔드가 Allowlist 검증을 마치므로, 레지스트리에 있는 앱은 신뢰하고 rewrite.
  // 미등록 slug 폴백에만 정적 Allowlist를 적용한다.
  let targetBase: string | null = null;
  let strip = false;
  let registered = false;
  try {
    const r = await fetch(`${BACKEND}/api/apps`, { next: { revalidate: 60 } });
    if (r.ok) {
      const j = await r.json();
      const app = (j.data ?? []).find((a: { slug: string; targetUrl: string; stripPrefix?: boolean }) => a.slug === found.slug);
      if (app) {
        targetBase = app.targetUrl;
        strip = app.stripPrefix === true;
        registered = true;
      }
    }
  } catch { /* 폴백 */ }
  targetBase ??= `https://${found.slug}.${DEFAULT_ALLOWED[0]}`;

  if (!registered && !isAllowedTarget(targetBase, DEFAULT_ALLOWED)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // 실제 통합 URL로 rewrite (단일도메인 SSO 유지, 프레임 태그 미사용)
  const destStr = buildRewriteDest(targetBase, found.slug, found.rest, req.nextUrl.search, strip);
  const dest = new URL(destStr);
  // 자기참조 루프 방지: rewrite 목적지가 요청 origin과 같으면 무한 프록시
  if (dest.origin === req.nextUrl.origin) {
    return new NextResponse(
      "508 Loop Detected: 등록된 앱 주소가 플랫폼 자신을 가리킵니다. 어드민에서 해당 앱의 targetUrl을 실제 앱 서버 주소로 수정하세요.",
      { status: 508 }
    );
  }
  const res = NextResponse.rewrite(dest);
  res.headers.set("x-app-slug", found.slug);
  return res;
}

export const config = { matcher: ["/apps/:slug*"] };
