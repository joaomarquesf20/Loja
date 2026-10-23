/**
 * Etiquetas em português (pt-PT) para os estados de encomenda e de pagamento.
 *
 * Fonte única partilhada pelos templates de email
 * (src/emails/order-status-update.tsx) e pela área de cliente
 * (src/app/conta/orders-client.tsx), para que o rótulo apresentado na loja
 * seja sempre igual ao do email de atualização de estado.
 *
 * Estados desconhecidos devolvem o valor original da base de dados em vez
 * de simplificar para uma etiqueta incorreta.
 */

const orderStatusLabels: Record<
  string,
  string
> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  PROCESSING:
    'Em processamento',
  SHIPPED: 'Expedida',
  DELIVERED: 'Entregue',
  READY_FOR_PICKUP:
    'Pronta para levantamento',
  PICKED_UP: 'Levantada',
  CANCELLED: 'Cancelada',
}

const paymentStatusLabels: Record<
  string,
  string
> = {
  PENDING: 'Pendente',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  FAILED: 'Falhado',
  REFUNDED: 'Reembolsado',
}

export function getOrderStatusLabel(
  status: string,
) {
  return (
    orderStatusLabels[status] ??
    status
  )
}

export function getPaymentStatusLabel(
  status: string,
) {
  return (
    paymentStatusLabels[
      status
    ] ?? status
  )
}
