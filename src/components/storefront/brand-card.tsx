import Link from 'next/link'

type BrandCardProps = {
  name: string
}

/**
 * Chip de marca do catálogo técnico: cartão branco pequeno com
 * borda definida; a pesquisa pela marca funciona por query (?q=).
 */
export default function BrandCard({
  name,
}: BrandCardProps) {
  return (
    <Link
      href={`/?q=${encodeURIComponent(
        name,
      )}#produtos`}
      className="group flex min-h-11 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-center transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
    >
      <span className="text-xs font-black uppercase tracking-[0.1em] text-gray-600 transition group-hover:text-gray-900">
        {name}
      </span>
    </Link>
  )
}
