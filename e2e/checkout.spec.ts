import {
  expect,
  test,
  type Page,
  type Route,
} from '@playwright/test'

/**
 * Os testes do checkout correm contra o servidor de desenvolvimento, mas
 * todas as chamadas /api são interceptadas no browser. Nenhum pedido
 * mutável (criar encomenda, iniciar pagamento) chega ao servidor, e
 * qualquer chamada não prevista falha o teste.
 */

const FINGERPRINT = 'a'.repeat(64)

const address = {
  id: 'addr-1',
  name: 'Ana Teste',
  addressLine1: 'Rua Exemplo 1',
  addressLine2: null,
  city: 'Lisboa',
  postalCode: '1000-001',
  country: 'Portugal',
}

const preview = {
  subtotal: 509.99,
  shippingCost: 0,
  tax: 95.36,
  total: 509.99,
  fingerprint: FINGERPRINT,
}

const order = {
  id: 'order-1',
  orderNumber: 'PFA-TESTE-0001',
  fulfillmentMethod: 'DELIVERY',
  paymentMethod: 'CARD',
  installmentCount: null,
  subtotal: 509.99,
  shippingCost: 0,
  tax: 95.36,
  total: 509.99,
  status: 'PENDING',
  paymentStatus: 'PENDING',
}

const payment = {
  orderId: 'order-1',
  paymentStatus: 'PENDING',
  paymentMethod: 'CARD',
  installmentCount: null,
  paymentProvider: 'PFA_SIMULATED',
  paymentReference: 'pfa_sim_e2e',
  amount: '509.99',
}

type Calls = {
  addresses: number
  addressSaves: number
  preview: number
  checkout: number
  initiate: number
  unexpected: string[]
}

type Overrides = {
  addresses?: (route: Route) => Promise<void> | void
  saveAddress?: (route: Route) => Promise<void> | void
  preview?: (route: Route) => Promise<void> | void
  checkout?: (route: Route) => Promise<void> | void
  initiate?: (route: Route) => Promise<void> | void
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function mockCheckoutApi(
  page: Page,
  overrides: Overrides = {},
): Promise<Calls> {
  const calls: Calls = {
    addresses: 0,
    addressSaves: 0,
    preview: 0,
    checkout: 0,
    initiate: 0,
    unexpected: [],
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    const method = request.method()

    if (pathname === '/api/addresses' && method === 'GET') {
      calls.addresses += 1
      return overrides.addresses
        ? overrides.addresses(route)
        : json(route, 200, { addresses: [address] })
    }

    if (
      pathname === '/api/addresses' &&
      method === 'POST'
    ) {
      calls.addressSaves += 1
      return overrides.saveAddress
        ? overrides.saveAddress(route)
        : json(route, 201, {
            address: {
              ...address,
              id: 'addr-2',
            },
          })
    }

    if (
      pathname === '/api/checkout/preview' &&
      method === 'POST'
    ) {
      calls.preview += 1
      return overrides.preview
        ? overrides.preview(route)
        : json(route, 200, { preview })
    }

    if (pathname === '/api/checkout' && method === 'POST') {
      calls.checkout += 1
      return overrides.checkout
        ? overrides.checkout(route)
        : json(route, 201, { order })
    }

    if (
      pathname === '/api/payments/initiate' &&
      method === 'POST'
    ) {
      calls.initiate += 1
      return overrides.initiate
        ? overrides.initiate(route)
        : json(route, 200, { payment })
    }

    // Leitura da sessão do next-auth (sem efeitos secundários).
    if (
      pathname.startsWith('/api/auth/') &&
      method === 'GET'
    ) {
      return route.continue()
    }

    calls.unexpected.push(`${method} ${pathname}`)
    return json(route, 500, {
      error: 'Pedido não previsto no teste E2E',
    })
  })

  return calls
}

async function openCheckoutPage(
  page: Page,
  overrides: Overrides = {},
) {
  const calls = await mockCheckoutApi(page, overrides)
  await page.goto('/checkout')
  await expect(
    page.getByRole('heading', {
      name: 'Finalizar compra',
    }),
  ).toBeVisible()
  await page.locator('#checkout-phone').fill('910000000')
  return calls
}

async function openSignedInCheckout(
  page: Page,
  overrides: Overrides = {},
) {
  const calls = await openCheckoutPage(
    page,
    overrides,
  )
  await page
    .getByRole('button', {
      name: 'Calcular total',
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Criar encomenda',
    }),
  ).toBeVisible()
  return calls
}

test.describe('checkout E2E', () => {
  // A compilação dev do Next é a pedido: o primeiro acesso a uma rota bloqueia
  // enquanto compila, o que fez o teste de redirecionamento falhar
  // esporadicamente. Aquecemos as rotas antes dos testes em vez de
  // depender de retries ou de timeouts generosos.
  test.beforeAll(async ({ request }) => {
    const checkoutResponse = await request.get('/checkout')
    const loginResponse = await request.get('/login')

    expect(checkoutResponse.status()).toBeLessThan(500)
    expect(loginResponse.status()).toBeLessThan(500)
  })

  test('utilizador sem sessão é redirecionado para o login', async ({
    page,
  }) => {
    const calls = await mockCheckoutApi(page, {
      addresses: (route) =>
        json(route, 401, {
          error: 'Não autenticado',
        }),
    })

    await page.goto('/checkout')

    await expect(page).toHaveURL(
      /\/login\?callbackUrl=%2Fcheckout/,
    )

    expect(calls.unexpected).toEqual([])
  })

  test('mostra totais vindos da pré-visualização do servidor', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page)

    await expect
      .poll(async () =>
        page.getByText(/509,99/).count(),
      )
      .toBeGreaterThan(0)
    await expect(page.getByText(/95,36/).first())
      .toBeVisible()

    expect(calls.unexpected).toEqual([])
  })

  test('erro de rede na pré-visualização mostra alerta', async ({
    page,
  }) => {
    const calls = await openCheckoutPage(page, {
      preview: (route) => route.abort('failed'),
    })
    await page
      .getByRole('button', {
        name: 'Calcular total',
      })
      .click()

    await expect(
      page.getByRole('alert').filter({
        hasText:
          /Failed to fetch|Não foi possível calcular o checkout/,
      }),
    ).toBeVisible()

    expect(calls.unexpected).toEqual([])
  })

  test('resposta inválida da pré-visualização mostra erro', async ({
    page,
  }) => {
    const calls = await openCheckoutPage(page, {
      preview: (route) =>
        json(route, 200, {
          preview: { subtotal: 'x' },
        }),
    })
    await page
      .getByRole('button', {
        name: 'Calcular total',
      })
      .click()

    await expect(
      page.getByText('Resposta inválida do servidor'),
    ).toBeVisible()

    expect(calls.unexpected).toEqual([])
  })

  test('telefone vazio impede a criação da encomenda', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page)

    // Alterar o telefone invalida a pré-visualização; o cálculo também valida o telefone.
    await page.locator('#checkout-phone').fill('')
    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()

    await expect(
      page.getByText('Indica o telefone de contacto.'),
    ).toBeVisible()
    expect(calls.checkout).toBe(0)
    expect(calls.initiate).toBe(0)
    expect(calls.unexpected).toEqual([])
  })

  test('levantamento sem nome de contacto é bloqueado', async ({
    page,
  }) => {
    const calls = await openCheckoutPage(page)

    await page
      .getByRole('radio', { name: 'Levantar em loja' })
      .check()

    // Mudar para levantamento pré-preenche o nome com o da morada;
    // limpar simula um utilizador sem nome de contacto.
    await page.locator('#checkout-pickup-name').fill('')
    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()

    await expect(
      page.getByText('Indica o nome para o levantamento.'),
    ).toBeVisible()
    expect(calls.preview).toBe(0)
    expect(calls.checkout).toBe(0)
    expect(calls.unexpected).toEqual([])
  })

  test('checkout de levantamento cria encomenda sem morada de entrega', async ({
    page,
  }) => {
    let orderBody: unknown = null

    const calls = await openCheckoutPage(page, {
      checkout: (route) => {
        orderBody = route.request().postDataJSON()
        return json(route, 201, { order })
      },
    })

    await page
      .getByRole('radio', { name: 'Levantar em loja' })
      .check()
    await expect(
      page.getByRole('heading', {
        name: 'Dados para levantamento',
      }),
    ).toBeVisible()
    await page.locator('#checkout-pickup-name').fill('Ana Teste')

    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()
    await expect(
      page.getByRole('button', { name: 'Criar encomenda' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Criar encomenda' }).click()

    await expect
      .poll(() => calls.initiate)
      .toBe(1)
    expect(calls.checkout).toBe(1)
    expect(orderBody).toMatchObject({
      fulfillmentMethod: 'PICKUP',
      shipping: {
        name: 'Ana Teste',
        phone: '910000000',
      },
    })
    expect(calls.unexpected).toEqual([])
  })

  test('duplo clique cria apenas uma encomenda', async ({
    page,
  }) => {
    let releaseOrder: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseOrder = resolve
    })

    const calls = await openSignedInCheckout(page, {
      checkout: async (route) => {
        await gate
        await json(route, 201, { order })
      },
    })

    const button = await page
      .getByRole('button', {
        name: 'Criar encomenda',
      })
      .elementHandle()

    if (!button) {
      throw new Error('Botão "Criar encomenda" não encontrado')
    }

    // O rótulo do botão muda para "A criar encomenda..." durante o
    // pedido, pelo que um segundo locator falharia. O handle clicado
    // em força dispensa a resolução do locator e dispara o segundo
    // clique no mesmo elemento, como um utilizador apressado faria.
    await button.click()
    await button.click({ force: true })

    releaseOrder()

    await expect
      .poll(() => calls.initiate)
      .toBe(1)
    expect(calls.checkout).toBe(1)
    expect(calls.unexpected).toEqual([])
  })

  test('encomenda criada inicia pagamento simulado uma vez', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page)

    await page
      .getByRole('button', { name: 'Criar encomenda' })
      .click()

    await expect
      .poll(() => calls.initiate)
      .toBe(1)
    expect(calls.checkout).toBe(1)
    expect(calls.unexpected).toEqual([])

    await expect(
      page.getByRole('status').filter({
        hasText: 'Encomenda criada',
      }),
    ).toBeVisible()
    await expect(
      page.getByText('PFA-TESTE-0001'),
    ).toBeVisible()
    await expect(
      page.getByText('pfa_sim_e2e'),
    ).toBeVisible()
  })

  test('falha no pagamento mostra alerta e permite repetir', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page, {
      initiate: (route) =>
        json(route, 500, {
          error: 'Erro interno do servidor',
        }),
    })

    await page
      .getByRole('button', { name: 'Criar encomenda' })
      .click()

    await expect(
      page.getByText(
        'A encomenda foi criada, mas o pagamento ainda não foi iniciado.',
      ),
    ).toBeVisible()

    await page
      .getByRole('button', {
        name: 'Tentar iniciar pagamento novamente',
      })
      .click()

    await expect
      .poll(() => calls.initiate)
      .toBe(2)
    expect(calls.checkout).toBe(1)
    expect(calls.unexpected).toEqual([])
  })

  test('erro do servidor ao criar encomenda não cria pedido duplicado', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page, {
      checkout: (route) =>
        json(route, 500, {
          error: 'Erro interno do servidor',
        }),
    })

    await page
      .getByRole('button', { name: 'Criar encomenda' })
      .click()

    await expect
      .poll(() => calls.checkout)
      .toBe(1)
    expect(calls.initiate).toBe(0)
    await expect(
      page.getByRole('button', {
        name: 'Criar encomenda',
      }),
    ).toBeEnabled()
    expect(calls.unexpected).toEqual([])
  })

  test('mostra subtotal, portos, IVA e total com montantes distintos', async ({
    page,
  }) => {
    const calls = await openSignedInCheckout(page, {
      preview: (route) =>
        json(route, 200, {
          preview: {
            ...preview,
            subtotal: 500,
            shippingCost: 5.9,
            tax: 90.72,
            total: 505.9,
          },
        }),
    })

    await expect(
      page
        .getByText('Subtotal', { exact: true })
        .locator('xpath=..'),
    ).toContainText('500,00')
    await expect(
      page
        .getByText('Portes', { exact: true })
        .locator('xpath=..'),
    ).toContainText('5,90')
    await expect(
      page
        .getByText('IVA incluído', { exact: true })
        .locator('xpath=..'),
    ).toContainText('90,72')
    await expect(
      page
        .getByText('Total', { exact: true })
        .locator('xpath=..'),
    ).toContainText('505,90')

    expect(calls.unexpected).toEqual([])
  })

  test('pré-visualização em curso desativa o botão de cálculo', async ({
    page,
  }) => {
    let releasePreview: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releasePreview = resolve
    })

    const calls = await openCheckoutPage(page, {
      preview: async (route) => {
        await gate
        await json(route, 200, { preview })
      },
    })

    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()

    await expect(
      page.getByRole('button', { name: 'A calcular...' }),
    ).toBeDisabled()

    releasePreview()

    await expect(
      page.getByRole('button', {
        name: 'Criar encomenda',
      }),
    ).toBeVisible()

    expect(calls.unexpected).toEqual([])
  })

  test('sem morada guardada, o cálculo pede morada e não pré-visualiza', async ({
    page,
  }) => {
    const calls = await openCheckoutPage(page, {
      addresses: (route) =>
        json(route, 200, { addresses: [] }),
    })

    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()

    await expect(
      page.getByText('Seleciona uma morada de entrega.'),
    ).toBeVisible()
    expect(calls.preview).toBe(0)
    expect(calls.checkout).toBe(0)
    expect(calls.unexpected).toEqual([])
  })

  test('guardar nova morada envia os dados e permite calcular o total', async ({
    page,
  }) => {
    let savedBody: unknown = null

    const calls = await openCheckoutPage(page, {
      addresses: (route) =>
        json(route, 200, { addresses: [] }),
      saveAddress: (route) => {
        savedBody = route.request().postDataJSON()
        return json(route, 201, {
          address: {
            ...address,
            id: 'addr-2',
            addressLine1: 'Rua Nova 2',
            city: 'Porto',
          },
        })
      },
    })

    await page
      .locator('#checkout-address-name')
      .fill('Ana Teste')
    await page
      .locator('#checkout-address-line-1')
      .fill('Rua Nova 2')
    await page
      .locator('#checkout-address-city')
      .fill('Porto')
    await page
      .locator('#checkout-address-postal-code')
      .fill('4000-001')

    await page
      .getByRole('button', {
        name: 'Guardar e usar esta morada',
      })
      .click()

    await expect
      .poll(() => calls.addressSaves)
      .toBe(1)
    expect(savedBody).toMatchObject({
      name: 'Ana Teste',
      addressLine1: 'Rua Nova 2',
      city: 'Porto',
      postalCode: '4000-001',
    })

    await page
      .getByRole('button', { name: 'Calcular total' })
      .click()

    await expect(
      page.getByRole('button', {
        name: 'Criar encomenda',
      }),
    ).toBeVisible()
    expect(calls.preview).toBe(1)
    expect(calls.unexpected).toEqual([])
  })

  test('erro do servidor ao guardar morada mostra o motivo', async ({
    page,
  }) => {
    const calls = await openCheckoutPage(page, {
      addresses: (route) =>
        json(route, 200, { addresses: [] }),
      saveAddress: (route) =>
        json(route, 400, {
          error: 'Código postal inválido',
        }),
    })

    await page
      .locator('#checkout-address-name')
      .fill('Ana Teste')
    await page
      .locator('#checkout-address-line-1')
      .fill('Rua Nova 2')
    await page
      .locator('#checkout-address-city')
      .fill('Porto')
    await page
      .locator('#checkout-address-postal-code')
      .fill('123')

    await page
      .getByRole('button', {
        name: 'Guardar e usar esta morada',
      })
      .click()

    await expect(
      page.getByRole('alert').filter({
        hasText: 'Código postal inválido',
      }),
    ).toBeVisible()
    await expect
      .poll(() => calls.addressSaves)
      .toBe(1)
    expect(calls.preview).toBe(0)
    expect(calls.checkout).toBe(0)
    expect(calls.unexpected).toEqual([])
  })

  test('duplo clique ao guardar morada cria apenas uma', async ({
    page,
  }) => {
    let releaseSave: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve
    })

    const calls = await openCheckoutPage(page, {
      addresses: (route) =>
        json(route, 200, { addresses: [] }),
      saveAddress: async (route) => {
        await gate
        await json(route, 201, {
          address: { ...address, id: 'addr-2' },
        })
      },
    })

    await page.locator('#checkout-address-name').fill('Ana Teste')
    await page.locator('#checkout-address-line-1').fill('Rua Nova 2')
    await page.locator('#checkout-address-city').fill('Porto')
    await page
      .locator('#checkout-address-postal-code')
      .fill('4000-001')

    const saveButton = await page
      .getByRole('button', {
        name: 'Guardar e usar esta morada',
      })
      .elementHandle()

    if (!saveButton) {
      throw new Error('Botão "Guardar e usar esta morada" não encontrado')
    }

    await saveButton.click()
    await saveButton.click({ force: true })

    releaseSave()

    await expect
      .poll(() => calls.addressSaves)
      .toBe(1)
    expect(calls.unexpected).toEqual([])
  })
})
