import {
  getOrderStatusLabel,
  getPaymentStatusLabel,
} from '@/lib/order-status-labels'

type StatusBadgeVariant =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'

type StatusBadgeProps = {
  variant: StatusBadgeVariant
  label: string
}

const badgeVariantClasses: Record<
  StatusBadgeVariant,
  string
> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300',
  warning:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger:
    'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300',
  neutral:
    'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
}

/**
 * Mapeamento semântico dos estados da encomenda: pendente chama a
 * atenção, estados em curso são informativos, estados finais bem
 * sucedidos ficam verdes e o cancelamento fica vermelho.
 */
const orderStatusVariants: Record<
  string,
  StatusBadgeVariant
> = {
  PENDING: 'warning',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  READY_FOR_PICKUP:
    'success',
  PICKED_UP: 'success',
  CANCELLED: 'danger',
}

const paymentStatusVariants: Record<
  string,
  StatusBadgeVariant
> = {
  PENDING: 'warning',
  AUTHORIZED: 'info',
  PAID: 'success',
  FAILED: 'danger',
  REFUNDED: 'neutral',
}

function StatusBadge({
  variant,
  label,
}: StatusBadgeProps) {
  return (
    <span
      data-variant={variant}
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeVariantClasses[variant]}`}
    >
      {label}
    </span>
  )
}

export function OrderStatusBadge({
  status,
}: {
  status: string
}) {
  return (
    <StatusBadge
      variant={
        orderStatusVariants[
          status
        ] ?? 'neutral'
      }
      label={getOrderStatusLabel(
        status,
      )}
    />
  )
}

export function PaymentStatusBadge({
  status,
}: {
  status: string
}) {
  return (
    <StatusBadge
      variant={
        paymentStatusVariants[
          status
        ] ?? 'neutral'
      }
      label={getPaymentStatusLabel(
        status,
      )}
    />
  )
}
