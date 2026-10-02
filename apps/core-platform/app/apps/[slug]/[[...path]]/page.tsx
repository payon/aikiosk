import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getActiveApps } from "@/lib/apps";

export default async function SubAppPage({ params }: { params: { slug: string; path?: string[] } }) {
  const apps = await getActiveApps();
  const app = apps.find((a) => a.slug === params.slug);
  if (!app) notFound();
  const sub = params.path?.length ? ` / ${params.path.join(" / ")}` : "";
  return (
    <Shell apps={apps} currentSlug={params.slug}>
      <h1 className="text-[clamp(24px,3vw,36px)] font-bold">{app.name}{sub}</h1>
      <p className="text-[clamp(14px,2vw,16px)] text-gray-600 mt-2">
        추가 로그인 없이 SSO 세션으로 바로 이용합니다.
      </p>
      <p className="text-[clamp(12px,1.5vw,18px)] mt-2 text-gray-500">
        미들웨어가 Allowlist 검증 후 해당 주소로 rewrite합니다. 별도 로그인 없이 SSO 세션이 전달됩니다.
      </p>
      <a href={`/apps/${params.slug}`} className="inline-flex min-h-[48px] items-center rounded-lg bg-orange-700 text-white px-4 mt-4 text-[clamp(16px,2vw,24px)]">
        {app.name} 열기
      </a>
      {(app.links || []).length > 0 && (
        <div className="mt-4">
          <h2 className="text-[clamp(16px,2vw,20px)] font-bold mb-2">관련 링크</h2>
          <ul className="grid gap-2">
            {(app.links || []).map((l) => (
              <li key={l.label + l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] items-center rounded-lg border px-4 text-[clamp(14px,2vw,16px)]">
                  {l.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
  );
}
