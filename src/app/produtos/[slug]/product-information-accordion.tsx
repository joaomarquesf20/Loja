import type { ReactNode } from 'react'

type ProductInformationItem = {
  id: string
  title: string
  content: ReactNode
  defaultOpen?: boolean
}

type ProductInformationAccordionProps = {
  items: ProductInformationItem[]
}

export default function ProductInformationAccordion({
  items,
}: ProductInformationAccordionProps) {
  return (
    <div>
      {items.map((item) => (
        <details
          key={item.id}
          id={item.id}
          open={item.defaultOpen}
          className="group border-b border-white/8"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-black uppercase tracking-[0.1em] text-white/72 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-brand">
            <span>{item.title}</span>

            <span
              aria-hidden="true"
              className="text-lg font-light text-white/34 transition group-open:rotate-45 group-open:text-brand"
            >
              +
            </span>
          </summary>

          <div className="pb-6">
            {item.content}
          </div>
        </details>
      ))}
    </div>
  )
}
