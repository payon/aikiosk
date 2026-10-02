import { isAllowedTarget, resolveAppSlug, buildRewriteDest } from "@/middleware";
import { rateLimit } from "@/lib/rate-limit";
import { AppCreateSchema, LoginSchema } from "@/lib/validation";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

describe("middleware allowlist (SSRF)", () => {
  const allow = ["rustkorea.cloud"];
  test("허용 도메인 통과", () => {
    expect(isAllowedTarget("https://library.rustkorea.cloud/x", allow)).toBe(true);
  });
  test("외부 도메인 차단", () => {
    expect(isAllowedTarget("https://evil.com/x", allow)).toBe(false);
  });
  test("http 차단", () => {
    expect(isAllowedTarget("http://library.rustkorea.cloud/", allow)).toBe(false);
  });
  test("메타데이터 IP 차단", () => {
    process.env.ALLOW_LOCAL_APPS = "false";
    expect(isAllowedTarget("http://169.254.169.254/", allow)).toBe(false);
    expect(isAllowedTarget("https://127.0.0.1/", allow)).toBe(false);
  });
  test("개발 로컬 서브앱 허용 (ALLOW_LOCAL_APPS=true)", () => {
    process.env.ALLOW_LOCAL_APPS = "true";
    expect(isAllowedTarget("http://127.0.0.1:4501/subapps/library", allow)).toBe(true);
    expect(isAllowedTarget("https://evil.com/x", allow)).toBe(false);
    delete process.env.ALLOW_LOCAL_APPS;
  });
});

describe("rewrite 매핑 (basePath 보존)", () => {
  test("외부 origin → /apps/<slug> 접두사 유지", () => {
    expect(buildRewriteDest("https://library.rustkorea.cloud", "library", "detail", "")).toBe(
      "https://library.rustkorea.cloud/apps/library/detail"
    );
    expect(buildRewriteDest("https://library.rustkorea.cloud", "library", "", "")).toBe(
      "https://library.rustkorea.cloud/apps/library"
    );
  });
  test("경로 포함 target → 기준 경로에 연결", () => {
    expect(buildRewriteDest("http://127.0.0.1:4501/subapps/library", "library", "", "")).toBe(
      "http://127.0.0.1:4501/subapps/library/"
    );
  });
  test("내부 origin → /apps/<slug>", () => {
    expect(buildRewriteDest("http://127.0.0.1:4511", "library", "", "")).toBe(
      "http://127.0.0.1:4511/apps/library"
    );
  });
  test("stripPrefix=true → /apps/<slug> 제거 후 그대로 전달", () => {
    expect(buildRewriteDest("https://library.rustkorea.cloud", "library", "", "", true)).toBe(
      "https://library.rustkorea.cloud/"
    );
    expect(buildRewriteDest("https://library.rustkorea.cloud", "library", "book/1", "", true)).toBe(
      "https://library.rustkorea.cloud/book/1"
    );
  });
});

describe("slug resolve", () => {
  test("/apps/library/detail", () => {
    expect(resolveAppSlug("/apps/library/detail")).toEqual({ slug: "library", rest: "detail" });
  });
  test("단일 slug", () => {
    expect(resolveAppSlug("/apps/aiplatform")).toEqual({ slug: "aiplatform", rest: "" });
  });
  test("비대상 null", () => {
    expect(resolveAppSlug("/admin")).toBeNull();
  });
});

describe("rate limit", () => {
  test("5회 제한", () => {
    const k = `t-${Date.now()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60000)).toBe(true);
    expect(rateLimit(k, 5, 60000)).toBe(false);
  });
});

describe("zod", () => {
  test("앱 생성 스키마", () => {
    expect(AppCreateSchema.safeParse({ name: "A", slug: "a1", targetUrl: "https://a.rustkorea.cloud", iconUrl: "/i.svg" }).success).toBe(true);
    expect(AppCreateSchema.safeParse({ name: "A", slug: "BAD SLUG", targetUrl: "http://x", iconUrl: "" }).success).toBe(false);
  });
  test("로그인 스키마", () => {
    expect(LoginSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true);
  });
});

describe("session token", () => {
  test("발급/검증", () => {
    const t = createSessionToken("u1", "ADMIN");
    expect(verifySessionToken(t)).toMatchObject({ userId: "u1", role: "ADMIN" });
  });
  test("위조 거부", () => {
    expect(verifySessionToken("e30.ffff")).toBeNull();
  });
});
