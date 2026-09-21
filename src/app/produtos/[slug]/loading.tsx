export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="min-h-screen bg-[#0b0d0f] text-white"
    >
      <div className="mx-auto max-w-7xl animate-pulse px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="h-3 w-52 rounded bg-white/7" />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:gap-14">
          <div className="aspect-[6/5] rounded-sm bg-white/6" />

          <div>
            <div className="h-3 w-28 rounded bg-white/8" />
            <div className="mt-5 h-10 w-full max-w-md rounded bg-white/10" />
            <div className="mt-3 h-3 w-24 rounded bg-white/7" />

            <div className="mt-8 border-y border-white/8 py-6">
              <div className="h-8 w-36 rounded bg-white/10" />
              <div className="mt-6 h-12 w-full rounded bg-white/9" />
            </div>

            <div className="mt-7 h-4 w-24 rounded bg-white/8" />
            <div className="mt-4 space-y-3">
              <div className="h-3 w-full rounded bg-white/6" />
              <div className="h-3 w-11/12 rounded bg-white/6" />
              <div className="h-3 w-4/5 rounded bg-white/6" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
