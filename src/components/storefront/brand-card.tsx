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
      className="group flex min-h-14 items-center justify-center rounded-sm border border-white/7 bg-white/[0.018] px-6 text-center transition hover:border-white/15 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
    >
      <span className="text-sm font-black uppercase tracking-[0.11em] text-white/58 transition group-hover:text-white">
        {name}
      </span>
    </Link>
  )
}
