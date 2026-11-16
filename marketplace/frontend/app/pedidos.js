// Pedidos do comprador: os valores monetários permanecem em wei até a exibição.
(() => {
  if (document.body.dataset.pagina !== "pedidos") return;

  const lista = document.getElementById("lista-pedidos");
  const estados = { "0": "Pago — aguardando envio", "1": "Enviado", "2": "Entregue", "3": "Cancelado" };
  let geracao = 0;

  function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto != null) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function data(valor) {
    return new Date(Number(valor) * 1000).toLocaleString("pt-BR");
  }

  function acao(texto, metodo, argumentos) {
    const botao = criar("button", texto, "botao secundario");
    botao.type = "button";
    botao.addEventListener("click", async () => {
      botao.disabled = true;
      try {
        await window.App.enviar(metodo, argumentos);
      } catch {
        // App.enviar já exibe a rejeição, o revert ou a falha de rede.
      } finally {
        botao.disabled = false;
      }
    });
    return botao;
  }

  async function renderizar() {
    const atual = ++geracao;
    const App = window.App;
    lista.replaceChildren();
    if (!App || !App.conta) {
      lista.append(criar("p", "Conecte sua carteira para consultar suas compras e seus reembolsos.", "vazio"));
      return;
    }
    if (!App.pronto) {
      lista.append(criar("p", "As compras ficam disponíveis quando a carteira está na Sepolia e o contrato pode ser consultado.", "vazio"));
      return;
    }

    const conta = App.conta;
    lista.append(criar("p", "Consultando seus pedidos…", "vazio"));
    try {
      const [pedidos, saldo] = await Promise.all([
        App.listarPedidos("comprador", conta),
        App.ler("saldos", conta),
      ]);
      const ids = [...new Set(pedidos.map((pedido) => String(pedido.produtoId)))];
      const produtos = await Promise.allSettled(ids.map((id) => App.ler("obterProduto", id)));
      if (atual !== geracao || App.conta !== conta || !App.pronto) return;
      const nomes = new Map();
      produtos.forEach((resultado, indice) => {
        if (resultado.status === "fulfilled") nomes.set(ids[indice], resultado.value.nome);
      });

      lista.replaceChildren();
      const credito = criar("section", null, "cartao");
      credito.append(
        criar("h2", "Seu saldo disponível no contrato"),
        criar("p", `${App.formatarEth(saldo)} ETH`, "espaco"),
        criar("p", "Reembolsos ficam disponíveis neste saldo. Use o saque para transferi-los à carteira; a operação exige gas.", "dica"),
      );
      if (BigInt(saldo) > 0n) credito.append(acao("Sacar saldo", "sacar", [String(saldo)]));
      lista.append(credito);

      if (!pedidos.length) {
        lista.append(criar("p", "Você ainda não realizou compras com esta conta.", "vazio"));
        return;
      }
      for (const pedido of [...pedidos].reverse()) {
        const status = String(pedido.status);
        const cartao = criar("article", null, "cartao");
        const nome = nomes.get(String(pedido.produtoId)) || `Produto #${pedido.produtoId}`;
        cartao.append(
          criar("h2", `Pedido #${pedido.id} — ${nome}`),
          criar("p", estados[status] || "Estado desconhecido", "espaco"),
          criar("p", `Valor pago: ${App.formatarEth(pedido.valor)} ETH`, "espaco"),
          criar("p", `Vendedor: ${pedido.vendedor}`, "hash"),
          criar("p", `Criado em ${data(pedido.criadoEm)}. Atualizado em ${data(pedido.atualizadoEm)}.`, "espaco"),
        );
        if (pedido.codigoRastreio) cartao.append(criar("p", `Código de rastreio informado: ${pedido.codigoRastreio}`, "hash"));
        if (status === "0") {
          cartao.append(
            criar("p", "O pagamento está em custódia. É possível cancelar antes de o vendedor registrar o envio.", "dica"),
            acao("Cancelar pedido", "cancelarPedido", [String(pedido.id)]),
          );
        } else if (status === "1") {
          cartao.append(
            criar("p", "Confirme somente após receber o produto: a confirmação libera o crédito ao vendedor.", "dica"),
            acao("Confirmar recebimento", "confirmarEntrega", [String(pedido.id)]),
          );
        } else if (status === "3") {
          cartao.append(criar("p", "O reembolso foi creditado no saldo do comprador no contrato. Caso ainda não tenha sacado, use o botão de saque acima.", "dica"));
        }
        const rastreio = criar("a", "Ver rastreamento", "link");
        rastreio.href = "rastreio.html";
        cartao.append(criar("p", null, "espaco"));
        cartao.lastChild.append(rastreio);
        lista.append(cartao);
      }
    } catch (erro) {
      if (atual !== geracao) return;
      lista.replaceChildren(criar("p", `Não foi possível consultar os pedidos: ${App.erro(erro)}`, "vazio"));
    }
  }

  document.addEventListener("app:estado", renderizar);
  renderizar();
})();
