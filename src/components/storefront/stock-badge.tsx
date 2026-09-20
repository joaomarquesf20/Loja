type StockBadgeProps = {
  inStock: boolean
}

export default function StockBadge({
  inStock,
}: StockBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${
        inStock
          ? 'text-success'
          : 'text-danger'
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          inStock
            ? 'bg-success'
            : 'bg-danger'
        }`}
      />

      {inStock
        ? 'Em stock'
        : 'Sem stock'}
    </span>
  )
}
