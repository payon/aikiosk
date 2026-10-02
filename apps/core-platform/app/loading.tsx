export default function Loading() {
  return (
    <main className="p-4" aria-label="로딩 중">
      <div className="mx-auto w-full max-w-[1600px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[2100px]:grid-cols-5 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/5] rounded-2xl bg-gray-100 animate-pulse" />)}
      </div>
    </main>
  );
}
