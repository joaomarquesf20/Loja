export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-[#0b0d0f] text-white"
    >
      <div className="mx-auto max-w-7xl animate-pulse px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="h-3 w-28 rounded bg-white/8" />

        <div className="pb-12 pt-9">
          <div className="h-3 w-32 rounded bg-white/8" />
          <div className="mt-4 h-12 w-56 rounded bg-white/10" />
          <div className="mt-5 h-4 w-full max-w-xl rounded bg-white/7" />
        </div>

        <div className="flex items-center justify-between border-y border-white/8 py-4">
          <div className="h-4 w-24 rounded bg-white/8" />
          <div className="h-10 w-48 rounded bg-white/8" />
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-12">
          <aside className="hidden space-y-5 lg:block">
            <div className="h-5 w-20 rounded bg-white/10" />
            <div className="h-28 rounded bg-white/6" />
            <div className="h-40 rounded bg-white/6" />
            <div className="h-36 rounded bg-white/6" />
          </aside>

          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-sm bg-[#111315] ring-1 ring-white/6"
              >
                <div className="aspect-[6/5] bg-white/6" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-20 rounded bg-white/8" />
                  <div className="h-5 w-4/5 rounded bg-white/10" />
                  <div className="h-6 w-24 rounded bg-white/10" />
                  <div className="h-9 rounded bg-white/7" />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  )
}
