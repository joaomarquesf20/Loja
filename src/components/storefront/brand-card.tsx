import Link from 'next/link'

type BrandCardProps = {
  name: string
}

export default function BrandCard({
  name,
}: BrandCardProps) {
  return (
    <Link
      href={`/?q=${encodeURIComponent(
        name,
      )}#produtos`}
      className="grid min-h-24 place-items-center rounded-2xl border border-line bg-surface px-5 text-center transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-950/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="text-base font-black uppercase tracking-[0.08em] text-foreground">
        {name}
      </span>
    </Link>
  )
}
