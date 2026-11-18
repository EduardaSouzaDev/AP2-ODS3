# CriptoMarket

Marketplace em HTML, CSS e JavaScript com Web3.js 4.16.0 e MetaMask na Ethereum Sepolia. O comprador paga uma unidade por vez; o contrato mantém o ETH em custódia até a confirmação de entrega ou a resolução administrativa. Créditos e reembolsos precisam ser sacados para chegar à carteira.

## Executar localmente

Na raiz deste repositório (`AP2-ODS3`):

```bash
python3 -m http.server 8000 --directory marketplace/frontend
```

Abra **http://localhost:8000**. Se o terminal já estiver dentro de `marketplace`, use `python3 -m http.server 8000 --directory frontend`. Encerre o servidor com `Ctrl+C`.

Não há instalação npm nem etapa de build. É necessário ter internet para carregar Web3.js pelo CDN e acessar a blockchain. Use um navegador com a extensão MetaMask instalada e habilitada; abra a página por localhost, em vez de abrir o HTML diretamente.

1. Clique em **Conectar Carteira** e autorize a conexão na MetaMask.
2. Se necessário, clique em **Trocar para Sepolia**. A rede deve ser Ethereum Sepolia, chain ID `11155111` (`0xaa36a7`). Se a carteira não reconhecer a rede, habilite a exibição de redes de teste na MetaMask e selecione Sepolia.
3. Confira o endereço e o saldo no cabeçalho. Use apenas contas e ETH de teste. Para transacionar, a conta precisa de SepoliaETH para o valor enviado e o gas.
4. O menu da carteira permite entrar como vendedor. A opção de administração aparece somente para a conta retornada por `dono()` no contrato.

## Configuração do contrato

`frontend/app/contrato.js` contém a ABI e os dados que já estavam registrados no projeto:

- Endereço: `0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08`.
- Bloco inicial configurado: `12141837`.
- [Contrato no Sepolia Etherscan](https://sepolia.etherscan.io/address/0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08).

Esses dados foram preservados. Ao conectar, a aplicação consulta o bytecode na Sepolia e os getters do contrato; se não encontrar contrato no endereço, exibe um aviso. Em um novo deploy, atualize endereço, bloco e ABI juntos. A equipe ainda deve registrar o hash da transação de deploy e confirmar a correspondência entre o código Solidity e o contrato implantado.

## Organização da integração

| Arquivo | Responsabilidade |
| --- | --- |
| `contacts/MeuDApp.sol` | Contrato CriptoMarket existente |
| `frontend/app/contrato.js` | ABI, endereço, bloco e chain ID |
| `frontend/app/app.js` | Provider MetaMask, conta/rede, consultas, transações, erros e eventos |
| `frontend/app/navbar.js` | Conexão, saldo, endereço e navegação por papel |
| `frontend/app/loja.js` | Catálogo, busca e compra com ETH |
| `frontend/app/pedidos.js` | Compras, cancelamento, recebimento e saque de reembolsos |
| `frontend/app/rastreio.js` | Estado, código informado pelo vendedor e eventos recentes |
| `frontend/app/vendedor.js` | Cadastro, edição, envio, cancelamento e saque |
| `frontend/app/admin.js` | Resumo, pausa, disputas e eventos do contrato |

A API compartilhada fica em `window.App`. Leituras usam `.call()` e transações usam `.send()`. Antes de pedir assinatura, a aplicação simula a execução, estima gas e confere conta, rede e saldo. Valores monetários usam strings e `BigInt`, sem conversão para ponto flutuante. Se o preço mudar desde a exibição do produto, a loja atualiza o preço e exige um novo clique.

O painel da transação mostra o hash, o link para o Sepolia Etherscan e o estado pendente, confirmada ou falhou. Confirmada significa incluída em bloco com execução bem-sucedida; não representa finalização da rede. Se houver perda de conexão depois de obter o hash, a aplicação mantém o resultado como pendente para consulta no explorador.

Os listeners `accountsChanged` e `chainChanged` invalidam os dados anteriores e recarregam a interface. **Sair** desconecta a conta apenas nesta aba; não revoga a permissão concedida ao site na MetaMask.

## Roteiro de teste manual

Prepare duas contas de teste com SepoliaETH: A (vendedor) e B (comprador). Para as ações administrativas, use a conta proprietária do contrato.

1. Conecte A. Pelo menu da carteira, abra **Vendedor** e cadastre um produto com preço pequeno, por exemplo `0.0001` ETH, e estoque `2`. A imagem é opcional.
2. Confira o hash e a confirmação; retorne à loja e localize o produto. O botão de compra do próprio anúncio deve ficar desabilitado.
3. Troque para B na MetaMask. Se B não estiver autorizada para este site, autorize-a nas permissões da carteira. Confira a atualização do endereço e compre uma unidade. Confira o valor na MetaMask antes de confirmar.
4. Em **Pedidos**, confira o estado **Pago**. Em **Rastreio**, confira o evento de compra e o link da transação.
5. Troque para A, abra **Vendedor** e registre um código de rastreio. O pedido passa para **Enviado**.
6. Troque para B e confirme o recebimento. O pedido passa para **Entregue** e o valor, descontada a taxa, vira crédito do vendedor no contrato.
7. Troque para A e use **Sacar saldo**. Confira a atualização do saldo do contrato e da carteira, considerando o gas.
8. Com B, compre a segunda unidade e cancele antes do envio. O reembolso vira crédito; use **Sacar saldo** em Pedidos para transferi-lo à carteira.
9. Com o dono, abra **Admin** e teste pausa/retomada. A pausa impede novos cadastros e compras. Para testar disputa, crie outro pedido, registre o envio e resolva-o como dono.
10. Teste rejeitar uma solicitação na MetaMask, trocar de rede e reconectar uma conta sem SepoliaETH. A interface deve explicar o problema, bloquear transações fora da Sepolia e esconder a administração de quem não é dono.

Eventos são consultados com `getPastEvents` nos últimos **até 5.000 blocos**, a partir do bloco de deploy configurado, em lotes que diminuem quando o RPC impõe limites. Falha na consulta dos logs é apresentada como indisponibilidade. O estado atual dos pedidos é lido diretamente do contrato, inclusive para pedidos fora dessa janela. Use **Atualizar dados** para buscar alterações feitas por outras contas ou abas; após suas próprias transações, a atualização é automática.

## Verificações automatizadas

Na raiz do repositório:

```bash
node --test marketplace/tests/web3.test.cjs
```

Os testes usam uma carteira e uma blockchain simuladas; não enviam transações nem comprovam o deploy na Sepolia. A validação final com a extensão MetaMask e o contrato implantado deve seguir o roteiro manual.

### Testes funcionais manuais

Foram definidos 14 casos de teste para verificar os principais fluxos da aplicação, incluindo operações de comprador, vendedor e administrador.

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

### Resumo dos resultados

| Indicador | Quantidade |
|---|---:|
| Casos planejados | 14 |
| Aprovados | 14 |
| Reprovados | 0 |
| Bloqueados | 0 |
| Não executados | 0 |

**Status da validação:** Aprovado.

### Documentação e evidências

Os resultados são registrados com o comportamento observado, status de aprovação, capturas de tela e hashes de transações quando aplicáveis. Todos eles podem ser encontrados na pasta `tests`

### Limitações

Os testes automatizados não realizam transações reais na blockchain. Os fluxos administrativos exigem acesso à conta proprietária do contrato ou uma implantação separada para QA.

A conclusão da validação depende da execução dos casos de teste e da análise dos defeitos encontrados.


## Publicação na Vercel

Importe o repositório e configure **Root Directory** como `marketplace/frontend`, **Framework Preset** como `Other` e deixe o comando de build vazio. O site é estático, com saída na própria raiz (`.`). Confira as [configurações de build da Vercel](https://vercel.com/docs/builds/configure-a-build). A publicação não foi feita nesta implementação; a equipe deve registrar a URL pública e repetir o roteiro nela.

## Pendências da entrega da equipe

Preencher integrantes e papéis, hash e comprovação do deploy, tabela dos recursos Solidity, URL da Vercel, vídeo e slides. O caminho `contacts/` foi mantido conforme a estrutura existente. O rastreamento mostra os registros on-chain, sem integração com transportadoras. As telas consultam dados pela MetaMask; sem provider disponível, exibem instruções para instalação.

## Uso de IA e referências

Codex auxiliou na implementação e revisão da integração Web3, scripts das páginas, testes simulados e documentação. A equipe deve revisar e compreender o código antes da apresentação.

- [Provider Ethereum da MetaMask](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/).
- [Transações com Web3.js](https://docs.web3js.org/guides/transactions/transactions/).
- [Consultas e eventos de contratos com Web3.js](https://docs.web3js.org/api/web3-eth-contract/class/Contract/).
