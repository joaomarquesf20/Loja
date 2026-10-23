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
      className="group flex min-h-12 items-center justify-center rounded-sm px-5 text-center transition hover:bg-white/[0.025] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
    >
      <span className="text-sm font-black uppercase tracking-[0.11em] text-white/52 transition group-hover:text-white">
        {name}
      </span>
    </Link>
  )
}
