/**
 * Catálogo partilhado dos métodos de envio da loja.
 *
 * Fonte única partilhada pelo checkout (src/app/checkout/checkout-client.tsx),
 * pela área de cliente (src/app/conta/orders-client.tsx) e pelos templates de
 * email (src/emails/order-confirmation.tsx), para que o método, o rótulo e a
 * estimativa de entrega apresentados na loja sejam sempre iguais aos do email
 * de confirmação.
 *
 * As estimativas são copy comercial e vivem aqui, em código, em vez da base de
 * dados: não têm regras deprecadas por região configuráveis pelo administrador.
 *
 * Encomendas levantadas em loja (`PICKUP`) não têm código de método de envio
 * (`shippingMethod` nulo na base de dados) e encomendas de entrega anteriores
 * à Etapa 6 também podem ter o campo nulo — nesse caso é assumido o envio
 * standard, tal como o motor de preços assumia antes do campo existir.
 */

export type FulfillmentMethodCode =
  | 'DELIVERY'
  | 'PICKUP'

export type ShippingMethodCode =
  | 'STANDARD'
  | 'EXPRESS'

export type ShippingMethodOptionId =
  | 'PICKUP'
  | 'STANDARD'
  | 'EXPRESS'

export type ShippingMethodOption = {
  /** Identificador do método no catálogo (por encomenda: PICKUP, STANDARD…). */
  id: ShippingMethodOptionId
  /** Modo de cumprimento correspondente na base de dados. */
  fulfillmentMethod: FulfillmentMethodCode
  /** Código do método de envio guardado em `Order.shippingMethod`; levantamento em loja não tem. */
  shippingMethodCode: ShippingMethodCode | null
  label: string
  estimate: string
}

export const SHIPPING_METHOD_OPTIONS: readonly ShippingMethodOption[] =
  [
    {
      id: 'STANDARD',
      fulfillmentMethod: 'DELIVERY',
      shippingMethodCode: 'STANDARD',
      label: 'Envio standard',
      estimate:
        'Entrega estimada em 2–5 dias úteis.',
    },
    {
      id: 'EXPRESS',
      fulfillmentMethod: 'DELIVERY',
      shippingMethodCode: 'EXPRESS',
      label: 'Envio expresso',
      estimate:
        'Entrega estimada em 1–2 dias úteis.',
    },
    {
      id: 'PICKUP',
      fulfillmentMethod: 'PICKUP',
      shippingMethodCode: null,
      label: 'Levantamento em loja',
      estimate:
        'Pronto para levantamento em 1–3 dias úteis após a confirmação do pagamento.',
    },
  ]

export function isShippingMethodCode(
  value: unknown,
): value is ShippingMethodCode {
  return (
    value === 'STANDARD' ||
    value === 'EXPRESS'
  )
}

/**
 * Devolve as opções do catálogo a apresentar para um modo de cumprimento,
 * pela ordem usada nos grupos de botões de opção do checkout.
 */
export function getShippingMethodOptions(
  fulfillmentMethod: FulfillmentMethodCode,
): ShippingMethodOption[] {
  return SHIPPING_METHOD_OPTIONS.filter(
    (option) =>
      option.fulfillmentMethod ===
      fulfillmentMethod,
  )
}

function getShippingMethodOption(
  fulfillmentMethod: FulfillmentMethodCode,
  shippingMethod: ShippingMethodCode | null,
): ShippingMethodOption {
  const optionId: ShippingMethodOptionId =
    fulfillmentMethod === 'PICKUP'
      ? 'PICKUP'
      : shippingMethod === 'EXPRESS'
        ? 'EXPRESS'
        : 'STANDARD'
  // `null` cobre encomendas de entrega anteriores à Etapa 6 e o valor por omissão.

  const option = SHIPPING_METHOD_OPTIONS.find(
    (candidate) => candidate.id === optionId,
  )

  if (!option) {
    throw new Error(
      'Método de envio não configurado no catálogo',
    )
  }

  return option
}

export function getShippingMethodLabel(
  fulfillmentMethod: FulfillmentMethodCode,
  shippingMethod: ShippingMethodCode | null,
) {
  return getShippingMethodOption(
    fulfillmentMethod,
    shippingMethod,
  ).label
}

export function getShippingMethodEstimate(
  fulfillmentMethod: FulfillmentMethodCode,
  shippingMethod: ShippingMethodCode | null,
) {
  return getShippingMethodOption(
    fulfillmentMethod,
    shippingMethod,
  ).estimate
}
