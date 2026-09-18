type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  aside?: React.ReactNode
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  aside,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-foreground sm:text-3xl">
          {title}
        </h2>

        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>

      {aside}
    </div>
  )
}
