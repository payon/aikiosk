import Link from "next/link";
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
      <h1 className="text-[clamp(24px,3vw,36px)] font-bold">페이지를 찾을 수 없습니다</h1>
      <Link href="/" className="min-h-[48px] inline-flex items-center rounded-lg bg-orange-700 text-white px-4 text-[clamp(16px,2vw,24px)]">런처로 이동</Link>
    </main>
  );
}
