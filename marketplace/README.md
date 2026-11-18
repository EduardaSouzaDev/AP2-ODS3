# CriptoMarket

Marketplace descentralizado com pagamento em custódia (escrow) na Ethereum Sepolia. Frontend em HTML, CSS e JavaScript puros, com Web3.js 4.16.0 e MetaMask.

**dApp publicada na Vercel:** **https://ap2-ods3-m9xc2re1c-uea2.vercel.app/index.html**
**Slides:** [`docs/slides.pdf`]

---

## 1. Tema e problema resolvido

**Tema:** marketplace (compra e venda de produtos entre pessoas).

**Problema:** em compras online entre desconhecidos, existe desconfiança dos dois lados. O comprador tem medo de pagar e não receber o produto. O vendedor tem medo de enviar e não receber o pagamento. Normalmente essa confiança depende de uma empresa intermediária, que cobra taxas altas, pode reter valores e controla as regras.

**Solução:** o contrato inteligente atua como intermediário neutro.

- O comprador paga em ETH e o valor fica retido no contrato.
- O vendedor envia o produto e registra o código de rastreio.
- Quando o comprador confirma o recebimento, o contrato libera o valor ao vendedor, menos uma taxa fixa de 2,5% da plataforma.
- Enquanto o pedido não foi enviado, comprador ou vendedor podem cancelá-lo, com reembolso integral.
- Se o comprador não confirmar um pedido já enviado, o administrador resolve a disputa.

**Por que blockchain:** as regras estão no código público e verificável e não podem ser alteradas depois do deploy. Nem o dono da plataforma consegue retirar o ETH em custódia; ele só pode decidir disputas, dentro das regras do contrato. Todo o histórico fica registrado em eventos públicos e auditáveis.

### Atores

| Ator | O que pode fazer |
|---|---|
| Vendedor | Cadastrar e editar produtos, registrar envio com código de rastreio, cancelar pedido ainda não enviado, sacar seu saldo |
| Comprador | Comprar enviando ETH, confirmar recebimento, cancelar pedido ainda não enviado, sacar reembolsos |
| Dono (administrador) | Resolver disputas, pausar e retomar o marketplace, receber e sacar a taxa de 2,5% |

### Estados do pedido

```
 comprar() ──▶ Pago ──marcarEnviado()──▶ Enviado ──confirmarEntrega()──▶ Entregue
                │                          │                                ▲
                │ cancelarPedido()         │ resolverDisputa(id, false) ────┘
                ▼                          │
            Cancelado ◀────────────────────┘ resolverDisputa(id, true)
```

---

## 2. Integrantes e papéis

| Integrante | Papel | Principais contribuições |
|---|---|---|
| **[PREENCHER: Vinícius Souza Costa]** | Desenvolvedor(a) do contrato | Modelagem, `contracts/MeuDApp.sol`, testes no Remix, deploy e verificação na Sepolia |
| **[PREENCHER: Eduarda Souza]** | Desenvolvedor(a) frontend | HTML, CSS, layout e identidade visual |
| **[PREENCHER: Lucas Lima Carioca]** | Integração Web3 | Web3.js, conexão com a MetaMask, chamadas, transações e eventos |
| **[PREENCHER: Oziel Bezerra de Lima]** | Documentação e QA | README, plano de testes, evidências, vídeo e apresentação |

---

## 3. Contrato na Sepolia (dados do deploy)

| Item | Valor |
|---|---|
| Rede | Ethereum Sepolia, chain ID `11155111` (`0xaa36a7`) |
| Endereço do contrato | `0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08` |
| Hash da transação de deploy | **0x02a6f04a6fc14f65861c91b382859e8ea202b486561c471aa7f50f14fc73dc69** |
| Bloco do deploy | `12141837` **0xd4b308eda9c2072d8d34a8835c36ec3cd85172db0f0ec8ffc7bd11f80f4e1459** |
| Conta do dono (deployer) | **0xa765F4ee8BfB169505c32069E1a3e08f2C0ae9e8** |
| Compilador | Solidity **0.8.24+commit.e11b9ed9** |
| Código verificado no Etherscan | **Sim** |
| Etherscan | [sepolia.etherscan.io/address/0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08](https://sepolia.etherscan.io/address/0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08) |

Capturas do Remix, da MetaMask e do Etherscan estão em [`docs/prints/`](docs/prints/).

---

## 4. Funções do contrato

Taxa da plataforma: 2,5% (`TAXA_BPS = 250`), descontada do vendedor somente quando a entrega é concluída.

Pagamentos usam o padrão *pull payment*: o contrato credita os valores em `saldos[conta]` e cada pessoa saca com `sacar(valor)`.

### Funções que alteram o estado (transações)

| Função | O que faz | Quem pode chamar | Eventos | Erros possíveis |
|---|---|---|---|---|
| `cadastrarProduto(nome, imagemURL, preco, estoque)` | Anuncia um produto | Qualquer conta, quem cadastra vira o vendedor | `ProdutoCadastrado` | `ContratoPausado`; `require` (nome, preço ou estoque inválidos) |
| `atualizarProduto(produtoId, novoPreco, novoEstoque, ativo)` | Altera preço, estoque e visibilidade | Vendedor do produto | `ProdutoAtualizado` | `ProdutoInexistente`, `NaoAutorizado`; `require` (preço zero) |
| `comprar(produtoId)` **payable** | Compra 1 unidade enviando o preço exato em ETH, o valor fica em custódia | Qualquer conta, exceto o próprio vendedor | `PedidoCriado` | `ContratoPausado`, `ProdutoInexistente`, `EstoqueInsuficiente`, `ValorIncorreto`; `require` (vendedor comprando o próprio produto) |
| `marcarEnviado(pedidoId, codigoRastreio)` | Registra o envio e o código de rastreio | Vendedor do pedido | `PedidoEnviado` | `PedidoInexistente`, `EstadoInvalido`, `NaoAutorizado`; `require` (código vazio ou com mais de 64 caracteres) |
| `confirmarEntrega(pedidoId)` | Conclui o pedido e credita 97,5% ao vendedor e 2,5% ao dono | Comprador do pedido | `EntregaConfirmada` | `PedidoInexistente`, `EstadoInvalido`, `NaoAutorizado` |
| `cancelarPedido(pedidoId)` | Cancela pedido ainda não enviado, credita reembolso integral ao comprador e devolve a unidade ao estoque | Comprador ou vendedor do pedido | `PedidoCancelado` | `PedidoInexistente`, `EstadoInvalido`, `NaoAutorizado` |
| `sacar(valor)` | Transfere o saldo creditado no contrato para a carteira | Qualquer conta com saldo | `Saque` | `SaldoInsuficiente`, `TransferenciaFalhou` |
| `resolverDisputa(pedidoId, favorComprador)` | Decide um pedido enviado e não confirmado: reembolsa o comprador (e tira 1 ponto de reputação do vendedor) ou libera o valor ao vendedor | **Somente o dono** | `DisputaResolvida` + `PedidoCancelado` ou `EntregaConfirmada` | `NaoAutorizado`, `PedidoInexistente`, `EstadoInvalido` |
| `definirPausa(valor)` | Pausa ou retoma novos cadastros e compras; pedidos em andamento continuam | **Somente o dono** | `PausaAlterada` | `NaoAutorizado` |

### Consultas (view/pure, sem custo de gas)

| Função | Retorno |
|---|---|
| `listarProdutos(inicio, quantidade)` | Página de produtos (máximo de 50 por chamada) |
| `listarPedidosDoComprador(conta, inicio, quantidade)` | Página de pedidos feitos pela conta |
| `listarPedidosDoVendedor(conta, inicio, quantidade)` | Página de pedidos recebidos pela conta |
| `obterProduto(id)` / `obterPedido(id)` | Um produto ou pedido (reverte com `ProdutoInexistente` / `PedidoInexistente`) |
| `totalProdutos()`, `totalPedidos()`, `contarPedidos(conta)` | Contadores |
| `saldos(conta)`, `reputacao(conta)`, `comprouProduto(conta, produtoId)` | Saldo para saque, reputação do vendedor e histórico de compra concluída |
| `dono()`, `pausado()`, `totalEmCustodia()` | Dados administrativos |
| `calcularTaxa(valor)` | Taxa de 2,5% sobre um valor |

### Eventos

`ProdutoCadastrado`, `ProdutoAtualizado`, `PedidoCriado`, `PedidoEnviado`, `EntregaConfirmada`, `PedidoCancelado`, `DisputaResolvida`, `Saque`, `PausaAlterada`.

---

## 5. Tabela de recursos do Solidity

Os números de linha se referem a `contracts/MeuDApp.sol`. No código, cada recurso está marcado com `// [Recurso: ...]`.

| Grupo | Onde aparece no código | Por que foi usado |
|---|---|---|
| **TiposDeDados** | `uint256` em preços, ids e totais (L28, L52-70); `int256 reputacao` (L87); `bool pausado` e `ativo` (L64, L30); `address public immutable dono` (L61); `address payable vendedor` (L25, L38); `string nome`, `imagemURL` e `codigoRastreio` (L26-27, L41); `bytes32 referencia` (L42, L470); `constant TAXA_BPS`, `BPS_DENOMINADOR`, `MAX_POR_PAGINA` e `MAX_RASTREIO` (L52-58) | `int256` porque a reputação pode ficar negativa quando o vendedor perde disputas. `immutable` porque o dono só é conhecido no deploy e não pode ser trocado. `constant` para a taxa e os limites fixos (mais barato em gas). `address payable` porque o vendedor recebe ETH. `bytes32` como comprovante único de cada pedido |
| **Funcoes** | `constructor` (L166); `external`: `comprar`, `cadastrarProduto`, `sacar` e as listagens; `public`: `calcularTaxa` (L409); `internal`: `_registrarPedido`, `_liberarAoVendedor`, `_reembolsar` (L418-462); `private`: `_mudarStatus`, `_gerarReferencia`, `_fimPagina`, `_listarPedidos` (L464-495); `view`: consultas; `pure`: `calcularTaxa`, `_fimPagina`; `payable`: `comprar` (L251) | `external` para funções chamadas só de fora (parâmetros em `calldata`, mais barato). `public` em `calcularTaxa` porque ela é usada pelo frontend e também internamente. `internal` para a lógica reaproveitada por várias funções (liberar pagamento, reembolsar). `private` para detalhes de implementação |
| **EstruturasDeControle** | `if / else if` em `comprar` (L261-265); `require` em `cadastrarProduto`, `atualizarProduto`, `marcarEnviado` e `comprar` (L187-189, L216, L236, L266); laços `for` em `listarProdutos` (L378) e `_listarPedidos` (L491), limitados por `MAX_POR_PAGINA` | Os laços são paginados (no máximo 50 itens por chamada), para que a consulta nunca ultrapasse o limite de gas mesmo com muitos produtos ou pedidos |
| **ArraysEMappings** | Array dinâmico `Produto[] produtos` (L77); mapping simples `saldos` (L83); mapping → struct `pedidos` (L80); mapping → array `pedidosDoComprador` e `pedidosDoVendedor` (L90-93); mapping aninhado `comprouProduto` (L96) | O array permite listar a loja. O mapping de struct dá acesso direto a um pedido pelo id. Os índices por conta alimentam "Meus pedidos" e a área do vendedor. `saldos` implementa o pull payment |
| **StructsEEnums** | `struct Produto` (7 campos, L23); `struct Pedido` (10 campos, L34); `enum StatusPedido { Pago, Enviado, Entregue, Cancelado }` (L15) | O enum é a máquina de estados do escrow e impede pular etapas, como confirmar entrega antes do envio ou cancelar depois do envio |
| **Modificadores** | `apenasDono` e `quandoAtivo` (sem parâmetro); `produtoExiste(id)`, `pedidoExiste(id)` e `noEstado(id, status)` (com parâmetro) (L131-159) | Controle de acesso e validação de estado reutilizáveis, sem repetir código em cada função |
| **EventosEErros** | 9 eventos com parâmetros `indexed` (L102-110); 9 erros personalizados (L116-124) usados com `revert` (ex.: L132, L262, L264, L312), além de `require` | Os eventos alimentam o histórico e o rastreamento no frontend (`getPastEvents` filtrando por `pedidoId` indexado). Os erros personalizados gastam menos gas que mensagens de texto e trazem dados úteis (ex.: `ValorIncorreto(esperado, enviado)`), que o frontend converte em mensagens claras |

### Segurança

- **Checks-Effects-Interactions** em `sacar`: verifica o saldo, atualiza `saldos` e só depois transfere o ETH.
- **Pull payment:** nenhuma função de negócio envia ETH diretamente; ela apenas credita saldo. Isso evita reentrância e impede que um destinatário malicioso trave o fluxo.
- **Controle de acesso:** `apenasDono` nas funções administrativas e verificação de comprador ou vendedor em cada pedido.
- **Máquina de estados** com o modificador `noEstado`.
- **Valor exato** em `comprar` (`msg.value == preco`), sem troco preso no contrato.
- **ETH enviado diretamente** ao contrato (sem chamar `comprar`) é rejeitado, porque não há `receive` nem `fallback`.
- **Laços paginados** contra negação de serviço por gas.
- **Proteção automática contra overflow** do Solidity 0.8.x.
- Nenhum contrato pronto foi copiado; nenhuma biblioteca externa foi usada.

---

## 6. Como acessar e executar

### Versão publicada

Acesse **https://ap2-ods3-m9xc2re1c-uea2.vercel.app/index.html** em um navegador com a extensão MetaMask.

**Configuração na Vercel:** Root Directory `marketplace/frontend`, Framework Preset `Other`, sem comando de build ([documentação](https://vercel.com/docs/builds/configure-a-build)).

### Executar localmente

Na raiz deste repositório (`AP2-ODS3`):

```bash
python3 -m http.server 8000 --directory marketplace/frontend
```

Abra **http://localhost:8000**. Se o terminal já estiver dentro de `marketplace`, use `python3 -m http.server 8000 --directory frontend`. Encerre o servidor com `Ctrl+C`.

Não há instalação npm nem etapa de build. É necessário ter internet para carregar a Web3.js pelo CDN e acessar a blockchain. Abra a página por localhost, e não abrindo o arquivo HTML direto no navegador.

### Configurar a MetaMask na Sepolia

1. Instale a extensão em [metamask.io](https://metamask.io) e crie uma carteira somente para testes.
2. No menu da MetaMask, abra **Redes** e ative **Mostrar redes de teste**.
3. Obtenha SepoliaETH grátis em um faucet, por exemplo o (https://cloud.google.com/application/web3/faucet/ethereum/sepolia).
4. No site, clique em **Conectar Carteira** e autorize. Se a carteira estiver em outra rede, clique em **Trocar para Sepolia** (chain ID `11155111`, `0xaa36a7`).
5. Confira o endereço e o saldo no cabeçalho. O menu da carteira permite entrar como vendedor. A opção **Admin** aparece somente para a conta retornada por `dono()`.

### Organização do frontend

| Arquivo | Responsabilidade |
| --- | --- |
| `frontend/index.html`, `pedidos.html`, `rastreio.html`, `vendedor.html`, `admin.html` | Estrutura das páginas (loja, pedidos, rastreio, vendedor e administração) |
| `frontend/styles.css` | Layout e identidade visual |
| `frontend/app/contrato.js` | ABI, endereço, bloco do deploy e chain ID |
| `frontend/app/app.js` | Provider MetaMask, conta e rede, consultas, transações, erros e eventos |
| `frontend/app/navbar.js` | Conexão, saldo, endereço e navegação por papel |
| `frontend/app/loja.js` | Catálogo, busca e compra com ETH |
| `frontend/app/pedidos.js` | Compras, cancelamento, recebimento e saque de reembolsos |
| `frontend/app/rastreio.js` | Estado, código informado pelo vendedor e eventos recentes |
| `frontend/app/vendedor.js` | Cadastro, edição, envio, cancelamento e saque |
| `frontend/app/admin.js` | Resumo, pausa, disputas e eventos do contrato |

O guia sugere `style.css` e `app.js` únicos. Optamos por dividir a lógica em um arquivo por página, com uma API compartilhada em `window.App` (`app.js`), para facilitar a manutenção e a divisão do trabalho na equipe.

### Integração Web3

- Leituras usam `.call()` e transações usam `.send()`.
- Antes de pedir a assinatura, a aplicação simula a execução, estima o gas e confere conta, rede e saldo.
- Valores monetários usam strings e `BigInt`, sem conversão para ponto flutuante.
- Se o preço mudar desde a exibição do produto, a loja atualiza o preço e exige um novo clique.
- O painel da transação mostra o hash, o link para o Sepolia Etherscan e o estado: pendente, confirmada ou falhou.
- Rejeições na MetaMask (código 4001), erros personalizados do contrato e falta de saldo são convertidos em mensagens compreensíveis.
- Os listeners `accountsChanged` e `chainChanged` invalidam os dados anteriores e recarregam a interface.
- Eventos são consultados com `getPastEvents` nos últimos até 5.000 blocos, a partir do bloco do deploy, em lotes que diminuem quando o RPC impõe limites. O estado atual dos pedidos é sempre lido direto do contrato.
- **Sair** desconecta a conta apenas nesta aba; não revoga a permissão do site na MetaMask.

---

## 7. Roteiro de teste

Prepare duas contas de teste com SepoliaETH: **A (vendedor)** e **B (comprador)**. Para as ações administrativas, use a conta dona do contrato.

1. Conecte A. Pelo menu da carteira, abra **Vendedor** e cadastre um produto com preço pequeno e estoque `2`. A imagem é opcional.
2. Confira o hash e a confirmação. Volte à loja e localize o produto; o botão de compra do próprio anúncio deve estar desabilitado.
3. Troque para B na MetaMask (autorize B no site, se necessário). Confira a atualização do endereço e compre uma unidade. Confira o valor na MetaMask antes de confirmar.
4. Em **Pedidos**, confira o estado **Pago**. Em **Rastreio**, confira o evento de compra e o link da transação.
5. Troque para A, abra **Vendedor** e registre um código de rastreio. O pedido passa para **Enviado**.
6. Troque para B e confirme o recebimento. O pedido passa para **Entregue**, e o valor menos a taxa vira crédito do vendedor.
7. Troque para A e use **Sacar saldo**. Confira o saldo do contrato e da carteira, considerando o gas.
8. Com B, compre a segunda unidade e cancele antes do envio. O reembolso vira crédito; use **Sacar saldo** em Pedidos.
9. Com o dono, abra **Admin** e teste pausar e retomar. A pausa impede novos cadastros e compras. Para testar disputa, crie outro pedido, registre o envio e resolva-o como dono.
10. Teste rejeitar uma solicitação na MetaMask, trocar de rede e conectar uma conta sem SepoliaETH. A interface deve explicar o problema, bloquear transações fora da Sepolia e esconder a administração de quem não é dono.

### Testes automatizados

A partir da raiz do repositório:

```bash
node --test marketplace/tests/web3.test.cjs
```

Esses testes usam o módulo `node:test` com carteira e blockchain simuladas. Eles verificam a lógica de integração do frontend, mas não enviam transações reais nem comprovam o deploy. Além deles, o contrato foi testado no Remix VM antes do deploy, nos fluxos de compra, envio, entrega, cancelamento, disputa, saque, pausa e erros personalizados.

### Resultado dos testes funcionais

O plano completo está em [`tests/PlanoDeTestes.md`](tests/PlanoDeTestes.md), com evidências (capturas, vídeo e hashes) em [`tests/evidencias/`](tests/evidencias/).

| ID | Caso de teste | Resultado |
|---|---|---|
| CT-01 | Conexão com a MetaMask | Aprovado |
| CT-02 | Detecção e alteração da rede | Aprovado |
| CT-03 | Cadastro de produto | Aprovado |
| CT-04 | Compra utilizando ETH | Aprovado |
| CT-05 | Registro de envio | Aprovado |
| CT-06 | Confirmação de recebimento | Aprovado |
| CT-07 | Saque do vendedor | Aprovado |
| CT-08 | Cancelamento e reembolso | Aprovado |
| CT-09 | Controle de acesso administrativo | Aprovado |
| CT-10 | Pausa e retomada do contrato | Aprovado |
| CT-11 | Rejeição de transação | Aprovado |
| CT-12 | Troca de conta ou rede | Aprovado |
| CT-13 | Histórico de eventos | Aprovado |
| CT-14 | Responsividade da interface | Aprovado |

**Resumo:** 14 casos planejados, 14 aprovados, 0 reprovados, 0 bloqueados, 0 não executados.

---

## 8. Limitações conhecidas e melhorias futuras

### Limitações

- Cada compra corresponde a uma unidade; não há carrinho com vários itens.
- A resolução de disputas depende do dono da plataforma, o que é um ponto de centralização.
- Não há prazo automático: se o comprador não confirmar a entrega, o valor fica em custódia até a decisão do dono.
- O rastreamento mostra apenas os registros on-chain; não há integração com transportadoras.
- A imagem do produto é apenas uma URL, que pode sair do ar.
- O histórico de eventos no frontend consulta até os últimos 5.000 blocos (o estado atual dos pedidos não é afetado).
- Os testes automatizados do frontend não fazem transações reais na blockchain.

### Melhorias futuras

- Liberação automática ao vendedor após um prazo sem contestação.
- Árbitros independentes ou votação para resolver disputas.
- Carrinho com vários produtos em uma única transação.
- Imagens armazenadas no IPFS.
- Avaliações de compradores, aproveitando o mapping `comprouProduto`.

**Custos de gas observados na Sepolia:** **Deploy:1.5 Gwei**, **Registro de produto:2.5 Gwei**, **Compra:2.5 Gwei**

---

### Referências

- [Documentação do Solidity](https://docs.soliditylang.org/)
- [Provider Ethereum da MetaMask](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)
- [Transações com Web3.js](https://docs.web3js.org/guides/transactions/transactions/)
- [Consultas e eventos de contratos com Web3.js](https://docs.web3js.org/api/web3-eth-contract/class/Contract/)
