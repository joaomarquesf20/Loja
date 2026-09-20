type BrandCardProps = {
  name: string
}

export default function BrandCard({
  name,
}: BrandCardProps) {
  return (
    <div className="grid min-h-24 place-items-center rounded-2xl border border-line bg-surface px-5 text-center transition hover:border-slate-300 hover:shadow-lg hover:shadow-slate-950/5">
      <span className="text-base font-black uppercase tracking-[0.08em] text-foreground">
        {name}
      </span>
    </div>
  )
}
