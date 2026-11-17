// O contrato registra estados e códigos; não consulta sistemas de transportadoras.
(() => {
  if (document.body.dataset.pagina !== "rastreio") return;

  const lista = document.getElementById("lista-rastreio");
  const estados = { "0": "Pago — aguardando envio", "1": "Enviado", "2": "Entregue", "3": "Cancelado" };
  let geracao = 0;

  function criar(tag, texto, classe) {
    const elemento = document.createElement(tag);
    if (texto != null) elemento.textContent = texto;
    if (classe) elemento.className = classe;
    return elemento;
  }

  function descrever(evento) {
    const valores = evento.returnValues || {};
    switch (evento.event) {
      case "PedidoCriado": return "Compra registrada; pagamento recebido em custódia.";
      case "PedidoEnviado": return `Envio registrado. Código: ${valores.codigoRastreio || "não informado"}.`;
      case "EntregaConfirmada": return "Entrega confirmada; crédito liberado ao vendedor e taxa à plataforma.";
      case "PedidoCancelado": return "Pedido cancelado; reembolso creditado ao comprador no contrato.";
      case "DisputaResolvida": return valores.favorComprador === true || valores.favorComprador === "true"
        ? "Disputa resolvida em favor do comprador."
        : "Disputa resolvida em favor do vendedor.";
      default: return evento.event || "Evento do pedido";
    }
  }

  async function renderizar() {
    const atual = ++geracao;
    const App = window.App;
    lista.replaceChildren();
    if (!App || !App.conta) {
      lista.append(criar("p", "Conecte sua carteira para acompanhar os pedidos em que você é comprador ou vendedor.", "vazio"));
      return;
    }
    if (!App.pronto) {
      lista.append(criar("p", "Selecione a Sepolia e aguarde a conexão com o contrato para consultar o rastreamento.", "vazio"));
      return;
    }
    const conta = App.conta;
    lista.append(criar("p", "Consultando pedidos e eventos recentes…", "vazio"));
    try {
      const [compras, vendas] = await Promise.all([
        App.listarPedidos("comprador", conta),
        App.listarPedidos("vendedor", conta),
      ]);
      const unicos = new Map([...compras, ...vendas].map((pedido) => [String(pedido.id), pedido]));
      const pedidos = [...unicos.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : 0);
      // A falha do provedor ao buscar logs não impede a exibição do estado atual.
      const historico = pedidos.length ? await Promise.allSettled([App.buscarEventos()]) : [];
      if (atual !== geracao || App.conta !== conta || !App.pronto) return;
      const eventosDisponiveis = historico[0]?.status === "fulfilled";
      const eventos = eventosDisponiveis ? historico[0].value : [];
      const porPedido = new Map();
      for (const evento of eventos) {
        const id = evento.returnValues?.pedidoId;
        if (id == null) continue;
        const chave = String(id);
        if (!porPedido.has(chave)) porPedido.set(chave, []);
        porPedido.get(chave).push(evento);
      }

      lista.replaceChildren();
      if (!pedidos.length) {
        lista.append(criar("p", "Esta conta ainda não possui compras nem pedidos recebidos.", "vazio"));
        return;
      }
      lista.append(criar("p", "O estado atual e o código vêm do contrato. O histórico abaixo inclui eventos recentes de até 5.000 blocos; pedidos antigos podem não ter eventos nessa janela. Não há consulta à transportadora.", "espaco dica"));
      if (historico[0]?.status === "rejected") {
        lista.append(criar("p", `O histórico de eventos está indisponível: ${App.erro(historico[0].reason)} O estado atual dos pedidos continua disponível.`, "espaco"));
      }
      for (const pedido of pedidos) {
        const cartao = criar("article", null, "cartao");
        const comprador = String(pedido.comprador).toLowerCase() === conta.toLowerCase();
        cartao.append(
          criar("h2", `Pedido #${pedido.id} — Produto #${pedido.produtoId}`),
          criar("p", comprador ? "Você é o comprador." : "Você é o vendedor.", "espaco"),
          criar("p", `Estado atual: ${estados[String(pedido.status)] || "desconhecido"}`, "espaco"),
          criar("p", `Última atualização: ${new Date(Number(pedido.atualizadoEm) * 1000).toLocaleString("pt-BR")}`, "espaco"),
          criar("p", pedido.codigoRastreio ? `Código de rastreio informado pelo vendedor: ${pedido.codigoRastreio}` : "O vendedor ainda não informou um código de rastreio.", "hash"),
          criar("h3", "Eventos recentes do pedido"),
        );
        const registros = porPedido.get(String(pedido.id)) || [];
        if (!registros.length) {
          cartao.append(criar("p", eventosDisponiveis ? "Nenhum evento encontrado para este pedido na janela consultada." : "Eventos temporariamente indisponíveis. Consulte o estado atual acima.", "espaco dica"));
        } else {
          const listaEventos = criar("ul", null, "historico");
          registros.sort((a, b) => {
            const blocoA = BigInt(a.blockNumber ?? 0);
            const blocoB = BigInt(b.blockNumber ?? 0);
            if (blocoA !== blocoB) return blocoA > blocoB ? -1 : 1;
            const logA = BigInt(a.logIndex ?? 0);
            const logB = BigInt(b.logIndex ?? 0);
            return logA > logB ? -1 : logA < logB ? 1 : 0;
          });
          for (const evento of registros) {
            const item = criar("li", descrever(evento));
            if (/^0x[0-9a-f]{64}$/i.test(evento.transactionHash || "")) {
              const link = criar("a", `Ver transação no Etherscan (bloco ${evento.blockNumber})`);
              link.href = `https://sepolia.etherscan.io/tx/${evento.transactionHash}`;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              item.append(criar("br"), link);
            }
            listaEventos.append(item);
          }
          cartao.append(listaEventos);
        }
        lista.append(cartao);
      }
    } catch (erro) {
      if (atual !== geracao) return;
      lista.replaceChildren(criar("p", `Não foi possível consultar o rastreamento: ${App.erro(erro)}`, "vazio"));
    }
  }

  document.addEventListener("app:estado", renderizar);
  renderizar();
})();
