# Requisitos do webhook do fornecedor de pagamentos — PFAutoParts

> Documento de requisitos para o fornecedor de pagamentos que vier a substituir o
> simulador. Baseado exclusivamente na auditoria do repositório (2026-10-14).
> **Estado: documentação apenas.** Não existe fornecedor real selecionado nem
> integrado, e a proteção contra repetição (replay) **não está implementada**.
> Revisão adversarial aplicada em 2026-10-14 (achados H1–H3, M1–M5, L1–L6).
> Correções de auditoria aplicadas em 2026-10-16 (H1, H2/R29, R15, R20, R26,
> R29–R32 e nova observação L7).
> **Atualização 2026-10-22 (etapa 1 de produção):** a janela temporal da
> assinatura passou a ser configurável por ambiente (R9/M1), a rotação de
> segredo com sobreposição passou a estar implementada (R11/L2/L3) e as
> rejeições do webhook passaram a ser registadas (L7). A deduplicação durável
> (R27–R35) continua **não implementada** e bloqueada por M5/R35, e a
> limitação de taxa (L4/429) continua inexistente.
> **Estado do documento e do código (2026-10-16).** Este ficheiro **não está
> versionado** (aparece como não rastreado no `git status`). As afirmações
> marcadas **atual** descrevem a **árvore de trabalho**, que inclui alterações
> ainda não confirmadas em `HEAD`; sempre que a distinção for relevante, o texto
> identifica-a explicitamente (§2, nota de estado; R29).

## 1. Objetivo e âmbito

Este documento define o **contrato mínimo** que qualquer fornecedor de pagamentos
real tem de cumprir para que a PFAutoParts possa implementar deduplicação durável
de webhooks.

Motivação (auditoria de pagamentos): a validação atual (assinatura HMAC +
timestamp ±5 min) garante **autenticidade e recência**, mas **não** constitui
proteção durável contra repetição. Um pedido assinado capturado pode ser
reenviado dentro da janela de 5 minutos.

Este documento **não** escolhe fornecedor, não fixa algoritmo de assinatura e não
define payloads concretos: todos esses pontos ficam explicitamente pendentes até
existir um contrato oficial (§8).

**Convenções de leitura:** **atual** = comportamento verificado na **árvore de
trabalho** do repositório (com indicação do ficheiro e, quando aplicável, da nota
de estado em §2); **exigido** = requisito proposto para a integração
com um fornecedor real; **pendente** = não determinável sem o contrato oficial
do fornecedor (§8).

## 2. Estado atual verificado no repositório

| Aspeto | Estado atual |
|---|---|
| Fornecedores implementados | Apenas `PFA_SIMULATED` (simulador de desenvolvimento) |
| Abstração de fornecedor | **Não existe** para pagamentos (só `ImageStorageAdapter`, para imagens) |
| Adaptador de fornecedor real | Inexistente — ver `knowledge.md` §6, item 6 |
| Identificador de evento | **Inexistente** em todo o contrato |
| Referência de pagamento | `paymentReference`, por encomenda |

Campos atualmente aceites no corpo assinado do webhook:

- `type` — `PAYMENT_PAID` \| `PAYMENT_FAILED`
- `orderId` — referência interna da encomenda (≤191)
- `paymentProvider` — texto livre, normalizado por *trim* e validado apenas por
  tamanho (≤100); cadeias vazias ou só com espaços são rejeitadas
- `paymentReference` — referência do pagamento (≤191, com o mesmo *trim* e a
  mesma rejeição de vazio)
- `amount` (apenas em `PAYMENT_PAID`) — string decimal, ex.: `"128.50"`
- `currency` (apenas em `PAYMENT_PAID`) — ISO 4217 maiúsculas, ex.: `"EUR"`

Campos de JSON desconhecidos são **descartados** pelo *parser* (ver §3, nota de
implementação).

Cabeçalhos atuais: `x-payment-signature` (`sha256=<64 hex>`) e
`x-payment-timestamp` (segundos).

**Nota de estado (2026-10-16).** Esta secção descreve a **árvore de trabalho**,
que não coincide com `HEAD`. Duas das garantias abaixo existem apenas como
alterações **não confirmadas**: a validação de montante e moeda no verificador
(`src/server/payment-webhook.ts`) e a discriminação da restrição de unicidade
(`classifyPaymentConstraintViolation`, `src/server/order-lifecycle.ts`). Em
`HEAD` o contrato do webhook não transporta `amount`/`currency` e qualquer
`P2002` é convertido em conflito de referência (ver R29).

Garantias já implementadas que o novo contrato **tem de preservar**:

- Assinatura verificada sobre o **corpo bruto**, com comparação em tempo constante
  (`timingSafeEqual`), janela temporal e limite de corpo (32 KB). Um
  `Content-Length` declarado acima do limite é rejeitado **antes** de o corpo ser
  lido; um corpo maior do que o limite é rejeitado durante a leitura —
  `src/server/payment-webhook.ts`.
- Validação de montante e moeda contra a encomenda; moeda única aceite (`EUR`).
- Unicidade da referência de pagamento por par fornecedor+referência
  (`@@unique([paymentProvider, paymentReference])`, `prisma/schema.prisma`).
- Guardas de estado: encomenda cancelada, reembolsada ou já paga com outro
  pagamento não aceita confirmação; pagamento confirmado não pode ser marcado
  como falhado — `src/server/order-lifecycle.ts`.
- Atualização *compare-and-set* (`updateMany` + verificação de `count`) dentro de
  transação, com o evento de histórico (`OrderEvent`) na mesma transação.
- Reintento legítimo: `FAILED` → `PENDING` com uma referência **nova**, que tem
  de ser diferente da anterior (uma referência repetida é recusada pelo serviço),
  registando `PAYMENT_RETRIED` na mesma transação —
  `src/server/payment-initiation.ts`.
- Fluxo simulado desativado em produção (imposto por `NODE_ENV`, nas rotas
  `payments/initiate` e `payments/simulate`).

**Nota de configuração (L1).** `PFA_ENABLE_SIMULATED_PAYMENTS` continua em
`.env.example`, mas **nenhum código de produção o lê**: o bloqueio em produção
depende apenas de `NODE_ENV`, e ambas as rotas do simulador comentam
explicitamente que ignoram flags de ambiente. Os testes verificam-no de forma
**intencional** — `src/app/api/payments/initiate/route.test.ts` e
`src/app/api/payments/simulate/route.test.ts` definem a variável como `''`,
`'TRUE'` e `'true'` com `NODE_ENV=production` e esperam 404 em todos os casos.
Assinalado como pendente em §8.

**Nota sobre o segredo do webhook (L2).** A implementação exige
`PAYMENT_WEBHOOK_SECRET` com **mínimo de 32 caracteres**. **Atualização
2026-10-22:** a sobreposição de segredos passou a estar implementada —
`PAYMENT_WEBHOOK_SECRET_PREVIOUS` (opcional, ≥32 caracteres) é aceite enquanto
segredo alternativo durante a rotação, e um valor configurado mas inválido
falha em fechado (500). A rotação pode, por isso, ser feita sem alteração
de código (R11/L3 cumprido no lado da loja; o fornecedor tem de documentar o
procedimento). Antes desta alteração existia apenas **um segredo ativo**.

**Nota sobre limitação de taxa (L4).** **Não existe limitação de taxa no caminho
do webhook** (`src/app/api/payments/webhook/route.ts`), nem na verificação da
assinatura: cada pedido autenticado provoca uma escrita na base de dados.
Considera-se uma lacuna de segurança e operacional; ver R20.

**Nota de observabilidade (L7).** **Atualização 2026-10-22:** a rota regista
agora `console.error` para erros de configuração e erros inesperados (respostas
**500**) e `console.warn` para as rejeições **401/400/404/409/413**, com
mensagens **estáticas** que não fazem eco de dados do pedido. Não existem
métricas nem alertas estruturados próprios do webhook — continua uma lacuna
operacional para o contrato de resposta (R20) e para a deteção de reenvios
anómalos (R31).

## 3. Requisito de identidade estável do evento

Cada entrega de webhook tem de transportar um **identificador de evento**:

- **R1 — Único.** Cada evento tem um identificador único e opaco.
- **R2 — Estável em reenvio.** Reentregas do **mesmo** evento mantêm o **mesmo**
  identificador. Sem isto, qualquer deduplicação é impossível.
- **R3 — Distinto entre eventos distintos.** Eventos diferentes para o mesmo
  pagamento (ex.: falha seguida de sucesso) têm identificadores diferentes.
  **Pré-requisito bloqueante (M5):** R1–R3 são condição necessária para a
  deduplicação durável (R27–R35). Se o fornecedor reutilizar um identificador
  entre eventos distintos, a deduplicação pode **bloquear um evento legítimo** e
  a implementação não deve avançar.
- **R4 — Documentado.** O fornecedor tem de declarar: formato, **comprimento
  máximo**, se é opaco ou estruturado, e o **âmbito de unicidade** (por conta, por
  comerciante, por pagamento ou global).
- **R5 — Não derivado.** O identificador não pode ser derivado apenas de campos
  do pagamento (referência, montante), sob pena de colidir com um evento
  legítimo posterior.

**Nota de implementação (2026-10-16).** O *parser* do webhook
(`src/server/payment-webhook.ts`, `parseEvent`) lê apenas os campos conhecidos
(`type`, `orderId`, `paymentProvider`, `paymentReference` e, em `PAYMENT_PAID`,
`amount` e `currency`) e **descarta silenciosamente** campos de JSON
desconhecidos, sem falhar. Acrescentar um identificador de evento exige, por
isso, alterar o contrato **e** o código: não basta o fornecedor passar a
enviá-lo. A assinatura, essa, cobriria automaticamente o campo novo, por incidir
sobre o corpo bruto (R6).

## 4. Requisito de autenticidade

- **R6 — Cobertura pela assinatura.** O identificador do evento e **todos** os
  campos relevantes para a segurança (tipo, encomenda, referência, montante,
  moeda, timestamp) têm de estar cobertos pelo mecanismo de assinatura. Um
  identificador não assinado é controlável pelo atacante e inútil para
  deduplicação.
- **R7 — Assinatura sobre o corpo bruto.** A assinatura tem de incidir sobre os
  bytes exatos recebidos, antes de qualquer normalização ou *parse*.
- **R8 — Algoritmo declarado.** **Não se assume HMAC-SHA256.** O algoritmo, o
  esquema de assinatura, o formato do cabeçalho e a codificação têm de ser
  declarados pelo fornecedor. A implementação atual usa HMAC-SHA256 sobre
  `timestamp + "." + corpo`, com cabeçalho `sha256=<hex>`; a compatibilidade tem
  de ser avaliada contra o contrato real.
- **R9 — Timestamp e janela.** O fornecedor tem de declarar a unidade, o
  significado (emissão ou entrega) e a tolerância de relógio. **Atual:** a
  janela de ±5 minutos é o **valor por omissão** (`PAYMENT_WEBHOOK_MAX_AGE_SECONDS`)
  e é agora **configurável por ambiente** (2026-10-22): inteiro entre 1 e 86400,
  com **falha em fechado** (500) em valor inválido. **Exigido (M1):** o valor
  efetivo em produção e a tolerância de relógio do fornecedor têm de ser
  acordados no contrato — pendente em §8, item 13.
- **R10 — Verificação em tempo constante** e rejeição *fail-closed* perante
  assinatura ausente, malformada ou inválida.
- **R11 — Rotação de segredo.** O fornecedor tem de documentar como se rotaciona
  o segredo e se existe sobreposição entre segredos. **Exigido (L3, não
  implementado):** durante a rotação, o servidor tem de aceitar **em simultâneo o
  segredo atual e o anterior** ao longo do período de sobreposição declarado.
  **Estado atual (L2):** existe apenas **um segredo ativo**, com mínimo de 32
  caracteres, pelo que esta exigência pressupõe alteração de código.

## 5. Semântica dos eventos de pagamento

- **R12 — Pagamento com sucesso** deve incluir: identificador do evento, tipo,
  referência do pagamento, referência da encomenda, **montante autoritativo** e
  **moeda autoritativa** (do lado do fornecedor, não do pedido do cliente).
- **R13 — Pagamento falhado** deve incluir: identificador do evento, tipo,
  referência do pagamento e referência da encomenda. Montante/moeda são
  opcionais.
- **R14 — Identidades: divulgação e mapeamento (M4).** O contrato tem de
  **declarar explicitamente** se o fornecedor distingue (a) **identidade do
  evento** (§3), (b) **identidade do pagamento** (o que o fornecedor considera
  *o* pagamento) e (c) **referência de pagamento**. **Não se assume que (b)
  exista como conceito separado:** se o fornecedor modelar a identidade apenas
  pela referência, a integração tem de **documentar o mapeamento** para os campos
  da loja. A loja usa hoje uma referência por tentativa: cada reintento gera uma
  referência nova, obrigatoriamente diferente da anterior — ver R15 e R26.
- **R15 — Reintentos: divulgação e mapeamento (M4).** O contrato tem de indicar
  se um novo pagamento após falha gera nova identidade de pagamento e/ou nova
  referência, ou se reutiliza as mesmas. **Não se assume que o fornecedor exponha
  uma "nova identidade de pagamento":** se esse conceito não existir, a
  integração tem de documentar como distingue uma tentativa da anterior.
  **Atual (árvore de trabalho):** a loja gera uma **nova referência** em cada
  reintento (`FAILED` → `PENDING`), obrigatoriamente diferente da anterior — a
  referência antiga deixa de corresponder ao pagamento em curso. O contrato do
  fornecedor tem de acomodar esse padrão, ou a integração tem de documentar o
  mapeamento inverso.
- **R16 — Reembolsos e cancelamentos.** O contrato tem de declarar se são
  comunicados como eventos e com que tipo, e se reutilizam a identidade do
  pagamento. Hoje não existe evento de reembolso ou cancelamento por webhook.
- **R17 — Eventos fora de ordem.** O contrato tem de declarar se os eventos
  podem chegar fora de ordem e como se deve decidir o estado final (ex.: falha
  após sucesso, sucesso após cancelamento). A loja resolve hoje conflitos com
  erro e nunca reverte um pagamento confirmado.

## 6. Garantias de entrega

- **R18 — Semântica de entrega.** A PFAutoParts assume **at-least-once**;
  qualquer garantia diferente tem de ser declarada.
- **R19 — Reintentos.** Política, agendamento de *backoff* e **janela de
  reintento** (tempo máximo durante o qual um evento pode ser reenviado).
  **Exigido ao fornecedor (L5):** repetir apenas em falhas transitórias
  (**500** e **429**, este último depois de existir limitação de taxa) e tratar
  os **4xx** relevantes como permanentes (400, 401, 404) — **com a exceção de
  409**, que hoje é ambíguo (ver R20) e não pode ser tratado automaticamente como
  repetível. Não se prescreve repetição para resultados ambíguos sem resolver
  primeiro essa ambiguidade.
- **R20 — Códigos de resposta.** A tabela distingue **atual** (verificado em
  `src/app/api/payments/webhook/route.ts`) de **exigido (H1, M2):**

  | Situação | Código | Estado | Origem no código |
  |---|---|---|---|
  | Evento aceite e processado | 200 | atual | rota |
  | Duplicado já processado, sem perda de corrida | 200 | atual | guardas de ciclo de vida; sem escritas adicionais |
  | Duplicado concorrente que perde o *compare-and-set* | 409 | atual | `OrderLifecycleConflictError` na transação (ver H1) |
  | Assinatura ou timestamp inválidos | 401 | atual | `PaymentWebhookAuthenticationError` |
  | Corpo inválido (JSON, tipo, formato de montante) | 400 | atual | `PaymentWebhookValidationError`, `OrderLifecycleValidationError` |
  | Encomenda não encontrada | 404 | atual | `OrderLifecycleNotFoundError` |
  | **Montante ou moeda não corresponde** | **409** | atual | `validatePaidAmount`, `validatePaidCurrency` |
  | Conflito de estado da encomenda | 409 | atual | guardas de ciclo de vida |
  | Corpo demasiado grande | 413 | atual | `RequestPayloadTooLargeError` |
  | Segredo mal configurado; erro inesperado | 500 | atual | `PaymentWebhookConfigurationError`; tratador final |
  | `P2002` não reconhecido (restrição fora do contrato) | 500 | atual (árvore de trabalho) | o erro original é reencaminhado (ver R29) |
  | Limitação de taxa excedida | 429 | **exigido** | **não existe hoje (L4)** |

  **O 409 atual é ambíguo (H1).** O mesmo código é devolvido em duas situações
  opostas: (a) **duplicado já aplicado** — uma reentrega que perdeu a
  comparação-e-troca, em que o pagamento **já está** confirmado; e (b) conflito
  em que o pagamento **não foi aplicado** (ex.: cancelamento concorrente). Além
  disso, o mesmo 409 transporta também **rejeições de payload** (montante ou
  moeda), que não são conflitos de estado. Os corpos diferem caso a caso (as
  mensagens são distintas), mas **não existe um discriminador estável e legível
  por máquina** — nem código de erro próprio, nem campo estruturado — pelo que um
  fornecedor não pode decidir de forma fiável entre "não repetir" e "repetir":
  mensagens em texto livre não são uma interface de contrato.

  **Critério de aceitação (R20).** O contrato tem de garantir uma distinção
  **explícita e fiável** entre (a) um evento já processado, cuja reentrega é
  idempotente, e (b) um evento **não aplicado** que pode exigir nova tentativa.
  Esta distinção **não existe** na implementação atual e é pré-requisito para a
  deduplicação durável (§7).

- **R21 — Duplicação sem efeitos duplicados.** Uma entrega duplicada **não** pode
  criar um segundo evento de histórico nem aplicar duas vezes uma transição de
  pagamento.

## 7. Requisitos de integração PFAutoParts

Preservação obrigatória do comportamento atual:

- **R22** — Validações de montante e moeda mantêm-se, com montante e moeda
  autoritativos do fornecedor como fonte de verdade.
- **R23** — Fronteiras de propriedade e autorização mantêm-se: o webhook é
  autenticado pela assinatura, não por sessão; nenhuma identidade de utilizador
  enviada pelo cliente é considerada.
- **R24** — Guardas de estado da encomenda (pagável, não cancelada, não
  reembolsada, não já paga com outro pagamento) mantêm-se.
- **R25** — Atualizações *compare-and-set* dentro de transação mantêm-se, com o
  evento de histórico na mesma transação.
- **R26** — Reintentos legítimos continuam permitidos (`FAILED` → `PENDING`,
  **nova referência**, obrigatoriamente diferente da anterior), e a deduplicação
  **não** pode bloquear eventos legítimos posteriores dessa tentativa.

Proposta de deduplicação durável (a implementar **somente** após aprovação e com
contrato real disponível; não implementada neste documento).

**Bloqueadores (M5):** R1–R3 (identidade estável e distinta) e R35 (verificação
prévia do âmbito dos identificadores) têm de estar **confirmados** com o
fornecedor antes de qualquer implementação.

- **R27 — Restrição de unicidade (H3).** Numa nova tabela de deduplicação de
  eventos de webhook, a chave única tem de refletir o **âmbito de unicidade
  declarado pelo fornecedor** (R4). O âmbito mínimo é `(paymentProvider, eventId)`,
  mas se os identificadores forem únicos apenas por comerciante ou conta, esse
  âmbito tem de ser **incluído na chave** — caso contrário, dois eventos legítimos
  e distintos podem ser tratados como duplicados e um pagamento real fica por
  aplicar. **Não se assume que `(paymentProvider, eventId)` seja universalmente
  suficiente** (R35).
- **R28 — Reclamação atómica.** A inserção da linha de deduplicação e as
  alterações de estado do pagamento/encomenda ocorrem na **mesma transação**.
  Se a transação falhar, a reclamação é revertida — uma falha transitória de BD
  **não** pode consumir o identificador deixando o pagamento por processar.
- **R29 — Violação de unicidade: discriminar a restrição (H2).** A implementação
  **não pode** tratar qualquer erro `P2002` como duplicado: tem de identificar
  **qual** restrição falhou (alvo da violação), porque existem duas na mesma
  transação com significados opostos:
  - **Colisão na linha de deduplicação** (identificador de evento repetido) →
    evento duplicado: devolver o estado atual com **200**, sem segunda escrita e
    sem segundo evento de histórico. **Alvo — não implementado:** a tabela de
    deduplicação não existe.
  - **Colisão em `(paymentProvider, paymentReference)`** (unicidade da encomenda,
    `prisma/schema.prisma`) → **conflito real** entre encomendas distintas:
    devolver 409 e **nunca** 200, sob pena de um pagamento legítimo ficar
    silenciosamente por aplicar. **Implementado na árvore de trabalho.**

  **Estado atual (árvore de trabalho, 2026-10-16):** existe discriminação da
  restrição. `classifyPaymentConstraintViolation`
  (`src/server/order-lifecycle.ts`) inspeciona o alvo da violação em
  `meta.driverAdapterError.cause.constraint` (formas `{ index }` ou `{ fields }`)
  e distingue a restrição de referência de pagamento de uma violação
  desconhecida. Só a primeira é convertida em "A referência de pagamento já
  pertence a outra encomenda" (**409**); um `P2002` não reconhecido, sem
  metadados ou com metadados inesperados **mantém o erro original** e resulta no
  **500** genérico. A função é usada por `recordVerifiedPayment`,
  `recordVerifiedPaymentFailure` e pela nova tentativa de pagamento
  (`src/server/payment-initiation.ts`).

  **Em `HEAD`** o comportamento é o que este documento descrevia antes desta
  correção: `isUniqueConstraintViolation` verifica **apenas**
  `error.code === 'P2002'` e não inspeciona o alvo da violação; o `catch` de
  `recordVerifiedPayment` converte **qualquer** `P2002` em "A referência de
  pagamento já pertence a outra encomenda". A discriminação é, portanto, uma
  alteração **não confirmada**.

  **O que continua por implementar (H2):** a colisão na linha de deduplicação.
  Não existe tabela de eventos de webhook no esquema (`prisma/schema.prisma`),
  não há identificador de evento (R1–R3) nem impressão do evento (R33). A
  deduplicação durável **não pode** ainda ser ativada: a discriminação existente
  é pré-condição necessária, mas não suficiente.
- **R30 — Entrega concorrente.** **Alvo (não implementado).** Duas entregas
  simultâneas do mesmo evento devem resolver-se pela restrição de unicidade, com
  o perdedor a devolver o estado atual. **Atual:** a arbitragem é feita pelo
  *compare-and-set* da encomenda e o perdedor recebe **409** — "A encomenda foi
  alterada durante a confirmação do pagamento" no fluxo de pagamento, "A
  encomenda foi alterada durante o registo da falha do pagamento" no fluxo de
  falha —, não 200. Ver H1 e R20.
- **R31 — Estado desconhecido.** Um evento reclamado mas cujo resultado não é
  determinístico tem de ser detetável, para reconciliação (ex.: campos de
  receção e de conclusão).
- **R32 — Retenção e limpeza (critério verificável, M3 + L6).** As linhas de
  deduplicação têm de ser retidas por, no mínimo, `max(janela máxima de reentrega
  do fornecedor, janela de assinatura de ±5 minutos)`. **A janela máxima de
  reentrega do fornecedor é desconhecida (pendente, §8, item 8)** — não se assume
  nenhum valor.
  - **Risco após expiração:** eliminada a linha de deduplicação, uma reentrega
    tardia volta a ser processada; as guardas de ciclo de vida absorvem a maior
    parte dos casos. O cenário antes descrito aqui — reentrega tardia do evento
    de falha a marcar novamente como falhado um pagamento que já estava em nova
    tentativa — **assumia reutilização da referência no reintento**. Como cada
    reintento gera agora uma referência nova (R26), a reentrega com a referência
    antiga deixa de corresponder ao pagamento iniciado e é rejeitada com **409**
    pela guarda de correspondência de referência
    (`src/server/order-lifecycle.ts`), sem alterar o estado. O risco residual
    passa a ser a reaplicação de eventos cuja referência ainda corresponde à
    tentativa em curso (absorvida pelas guardas de estado) e a perda de rasto de
    tentativas anteriores — que é o que a política de retenção tem de cobrir.
  - **Crescimento e operação (L6):** o armazenamento de deduplicação tem de ter
    uma política de limpeza/expurgo operacionalmente sustentável (por exemplo,
    expurgo periódico por idade, com possibilidade de particionamento), **sem**
    que os requisitos fixem volumes de tráfego ou durações concretas — esses
    valores dependem do fornecedor e de dados de produção ainda inexistentes.

- **R33 — Impressão do evento (H3).** Cada linha de deduplicação tem de guardar
  uma **impressão imutável do evento** (por exemplo, *hash* dos campos assinados
  relevantes, ou os campos-chave: encomenda, tipo, referência, montante, moeda).
  Sem isto, uma reentrega com o mesmo identificador mas payload diferente é
  indistinguível de uma reentrega legítima.

- **R34 — Mesmo identificador, payload diferente (H3).** Se um identificador de
  evento já conhecido chegar com payload divergente (encomenda, tipo, referência,
  montante ou moeda diferentes), a resposta **não pode** ser um sucesso
  idempotente: tem de ser um **erro explícito** (5xx ou 409, a fixar no contrato)
  com **alerta operacional**, para investigação. Devolver 200 nessa situação
  deixaria o emissor convencido de que o payload foi aplicado.

- **R35 — Verificação prévia do âmbito dos identificadores (H3).** Antes de
  implementar, tem de ser **verificado** com o fornecedor que R1–R3 se cumprem,
  qual é o âmbito real de unicidade (R4) e se a reentrega preserva exatamente o
  mesmo payload. **Não se assume** que `(paymentProvider, eventId)` é a chave
  correta (R27), nem que a reentrega é idêntica (R33–R34).

## 8. Pendente até haver fornecedor real

Nada nesta secção pode ser respondido por suposição. Fica bloqueado até existir
um fornecedor escolhido e o respetivo contrato oficial:

1. Nome do campo e formato do identificador de evento, e o seu âmbito de
   unicidade (R1–R5).
2. Algoritmo e esquema de assinatura, cabeçalhos e codificação (R8).
3. Unidade e semântica do timestamp, e tolerância de relógio (R9).
4. Procedimento de rotação de segredo (R11).
5. Representação autoritativa de montante e moeda (R12).
6. Semântica de identidade de pagamento e de reintentos (R14–R15).
7. Eventos de reembolso e cancelamento (R16).
8. Política de reintentos, janela de reintento e garantias de entrega
   (R18–R19) — necessárias para definir a retenção verificável (R32). A janela
   máxima de reentrega **é desconhecida** e não se assume nenhum valor.
9. Se o fornecedor oferece idempotência do lado dele (evitando duplicados à
   partida) ou apenas entrega repetida.
10. Variável `PFA_ENABLE_SIMULATED_PAYMENTS`, que permanece em `.env.example` sem
    qualquer leitura em código de produção (limpeza ou remoção pendente; ver L1).
11. Se a reentrega de um evento preserva **exatamente** o mesmo payload
    (necessário para R33–R34) e se o fornecedor expõe algum *hash*, versão ou
    identificador de correlação do evento.
12. Âmbito real de unicidade dos identificadores de evento e se existem
    identificadores por comerciante/conta (R4, R27, R35).
13. Decisão interna pendente: se a janela de assinatura passa a ser configurável
    (R9) e qual o valor por omissão.
    **Resolvido (2026-10-22):** configurável via `PAYMENT_WEBHOOK_MAX_AGE_SECONDS`
    (inteiro 1–86400, omissão 300, falha em fechado em valor inválido). O valor
    efetivo de produção continua a acordar com o fornecedor.

## 9. Referências no código

- Verificação e validação do webhook: `src/server/payment-webhook.ts`
- Rota do webhook: `src/app/api/payments/webhook/route.ts`
- Ciclo de vida e guardas de pagamento: `src/server/order-lifecycle.ts`
- Iniciação e reintento de pagamento: `src/server/payment-initiation.ts`
- Reembolso: `src/server/payment-refund.ts`
- Simulador e contrato atual: `scripts/simulate-payment-paid.mjs`
- Esquema e unicidade da referência: `prisma/schema.prisma`
- Guardas de produção do simulador e testes que as fixam (L1):
  `src/app/api/payments/initiate/route.ts`,
  `src/app/api/payments/simulate/route.ts` e respetivos `route.test.ts`
- Segredo, configuração e observabilidade do webhook (L2, L4, L7):
  `.env.example`, `src/server/payment-webhook.ts`
- Contexto geral e lacunas: `knowledge.md` §5, §6 (item 6)
