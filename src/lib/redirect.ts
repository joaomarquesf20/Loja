/**
 * Navegação completa do browser para um URL externo (por exemplo a
 * página de Checkout alojada no Stripe). Não usamos o router do Next:
 * a sessão de pagamento vive fora da aplicação e o retorno devolve o
 * utilizador a /checkout/sucesso ou /checkout/cancelado com um estado
 * fresco.
 *
 * Está isolado num módulo para os testes dos componentes poderem
 * fazer mock da navegação sem tocar no objeto location do jsdom.
 */
export function redirectToExternalUrl(
  url: string,
) {
  window.location.href = url
}
