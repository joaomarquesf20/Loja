type PriceProps = {
  value: number
  className?: string
}

export default function Price({
  value,
  className,
}: PriceProps) {
  const formatted = new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    },
  ).format(value)

  return (
    <span className={className}>
      {formatted}
    </span>
  )
}
