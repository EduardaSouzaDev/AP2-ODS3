(() => {
  "use strict";
  if (document.body.dataset.pagina !== "admin") return;

  const $ = (id) => document.getElementById(id);
  const limiteUint = (1n << 256n) - 1n;
  let geracao = 0;
  let carregando = false;
  let recarregar = false;
  let enviando = false;
  let resumoPronto = false;
  let pausado = false;

  function podeAgir() {
    return window.App?.pronto && window.App.conta && window.App.ehDono;
  }

  function bloquear() {
    $("area-admin").querySelectorAll("button").forEach((botao) => {
      botao.disabled = enviando || !podeAgir() || !resumoPronto;
    });
  }

  function avisar(error) {
    window.App.mensagem(window.App.erro(error), "erro");
  }

  async function transacionar(nome, args, depois) {
    if (enviando || !podeAgir() || !resumoPronto) return;
    const conta = window.App.conta;
    enviando = true;
    bloquear();
    try {
      await window.App.enviar(nome, args);
      if (window.App.conta === conta && depois) depois();
    } catch {
      // App.enviar já apresenta o erro da carteira ou do contrato.
    } finally {
      enviando = false;
      bloquear();
    }
  }

  function descreverEvento(evento) {
    const valores = evento.returnValues || {};
    switch (evento.event) {
      case "ProdutoCadastrado": return `Produto #${valores.produtoId} cadastrado: ${valores.nome}`;
      case "ProdutoAtualizado": return `Produto #${valores.produtoId} atualizado`;
      case "PedidoCriado": return `Pedido #${valores.pedidoId} criado — ${window.App.formatarEth(valores.valor)} ETH`;
      case "PedidoEnviado": return `Pedido #${valores.pedidoId} enviado — rastreio ${valores.codigoRastreio}`;
      case "EntregaConfirmada": return `Entrega do pedido #${valores.pedidoId} confirmada`;
      case "PedidoCancelado": return `Pedido #${valores.pedidoId} cancelado`;
      case "DisputaResolvida": return `Disputa do pedido #${valores.pedidoId} resolvida a favor do ${valores.favorComprador === true || valores.favorComprador === "true" ? "comprador" : "vendedor"}`;
      case "Saque": return `Saque de ${window.App.formatarEth(valores.valor)} ETH por ${window.App.enderecoCurto(valores.conta)}`;
      case "PausaAlterada": return valores.pausado === true || valores.pausado === "true" ? "Marketplace pausado" : "Marketplace retomado";
      default: return evento.event || "Evento do contrato";
    }
  }

  function desenharEventos(eventos) {
    const lista = $("feed-eventos");
    lista.replaceChildren();
    const ordenados = [...eventos].sort((a, b) => {
      const blocoA = BigInt(a.blockNumber);
      const blocoB = BigInt(b.blockNumber);
      if (blocoA !== blocoB) return blocoA > blocoB ? -1 : 1;
      const indiceA = BigInt(a.logIndex || 0);
      const indiceB = BigInt(b.logIndex || 0);
      return indiceA === indiceB ? 0 : indiceA > indiceB ? -1 : 1;
    }).slice(0, 30);
    if (!ordenados.length) {
      const vazio = document.createElement("li");
      vazio.textContent = "Nenhum evento encontrado na janela de blocos recentes.";
      lista.append(vazio);
      return;
    }
    for (const evento of ordenados) {
      const item = document.createElement("li");
      const descricao = document.createElement("p");
      descricao.textContent = descreverEvento(evento);
      item.append(descricao, document.createTextNode(`Bloco ${evento.blockNumber} · `));
      if (/^0x[0-9a-f]{64}$/i.test(evento.transactionHash || "")) {
        const link = document.createElement("a");
        link.href = `https://sepolia.etherscan.io/tx/${evento.transactionHash}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ver transação";
        item.append(link);
      }
      lista.append(item);
    }
  }

  async function atualizar() {
    const minhaGeracao = ++geracao;
    const app = window.App;
    const autorizado = Boolean(app?.pronto && app.conta && app.ehDono);
    $("acesso").hidden = autorizado;
    $("area-admin").hidden = !autorizado;
    if (!autorizado) {
      $("acesso").textContent = app?.pronto && app.conta
        ? "Esta carteira não é a proprietária do contrato."
        : "Conecte a carteira proprietária à rede Sepolia para acessar a administração.";
      resumoPronto = false;
      recarregar = false;
      return;
    }
    resumoPronto = false;
    bloquear();
    if (carregando) {
      recarregar = true;
      return;
    }
    carregando = true;
    const conta = app.conta;
    const contrato = app.contrato;
    try {
      const [resumo, historico] = await Promise.allSettled([
        Promise.all([
          app.ler("TAXA_BPS"), app.ler("BPS_DENOMINADOR"),
          app.ler("totalProdutos"), app.ler("totalPedidos"),
          app.ler("totalEmCustodia"), app.ler("pausado"),
        ]),
        app.buscarEventos("allEvents"),
      ]);
      if (minhaGeracao !== geracao || app.conta !== conta || app.contrato !== contrato || !podeAgir()) return;
      if (resumo.status === "fulfilled") {
        const [taxa, denominador, produtos, pedidos, custodia, estado] = resumo.value;
        const percentualBps = BigInt(taxa) * 10_000n / BigInt(denominador);
        const fracao = (percentualBps % 100n).toString().padStart(2, "0").replace(/0+$/, "");
        $("taxa-valor").textContent = `${percentualBps / 100n}${fracao ? `,${fracao}` : ""}%`;
        $("total-produtos").textContent = String(produtos);
        $("total-pedidos").textContent = String(pedidos);
        $("total-custodia").textContent = `${app.formatarEth(custodia)} ETH`;
        pausado = estado === true || estado === "true";
        $("estado-pausa").textContent = pausado ? "Pausado" : "Ativo";
        $("btn-pausa").textContent = pausado ? "Retomar marketplace" : "Pausar marketplace";
        resumoPronto = true;
      } else {
        avisar(resumo.reason);
      }
      if (historico.status === "fulfilled") {
        desenharEventos(historico.value);
      } else {
        const item = document.createElement("li");
        item.textContent = `Não foi possível consultar os eventos recentes: ${app.erro(historico.reason)}`;
        $("feed-eventos").replaceChildren(item);
      }
      bloquear();
    } catch (error) {
      if (minhaGeracao === geracao) avisar(error);
    } finally {
      carregando = false;
      if (recarregar) {
        recarregar = false;
        void atualizar();
      }
    }
  }

  $("feed-eventos").previousElementSibling.textContent = "Eventos recentes do contrato";
  $("btn-pausa").addEventListener("click", () => void transacionar("definirPausa", [!pausado]));
  $("form-disputa").addEventListener("submit", (event) => {
    event.preventDefault();
    const texto = $("disputa-id").value.trim();
    if (!/^\d+$/.test(texto) || BigInt(texto) < 1n || BigInt(texto) > limiteUint) {
      avisar(window.App.validacao("Informe um número inteiro de pedido maior que zero."));
      return;
    }
    const decisao = $("disputa-favor").value;
    if (!["comprador", "vendedor"].includes(decisao)) {
      avisar(window.App.validacao("Selecione quem receberá o crédito da disputa."));
      return;
    }
    void transacionar("resolverDisputa", [BigInt(texto).toString(), decisao === "comprador"], () => $("form-disputa").reset());
  });
  document.addEventListener("app:estado", () => void atualizar());
  void atualizar();
})();
