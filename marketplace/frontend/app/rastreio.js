const ROTULO_EVENTO = {
  PedidoCriado: () => "Pedido criado e pagamento recebido pelo contrato",
  PedidoEnviado: (rv) =>
    `Pedido enviado — código de rastreio: ${rv.codigoRastreio}`,
  EntregaConfirmada: () =>
    "Entrega confirmada pelo comprador; valor liberado ao vendedor",
  PedidoCancelado: () => "Pedido cancelado e valor reembolsado",
  DisputaResolvida: (rv) =>
    `Disputa resolvida a favor do ${rv.favorComprador ? "comprador" : "vendedor"}`,
};

PAGINAS.rastreio = async function paginaRastreio(id) {
  const box = $("#lista-rastreio");
  if (!App.conta) {
    box.innerHTML = pedirConexao();
    return;
  }
  if (!box.children.length) box.innerHTML = vazio("Carregando rastreamento…");

  let pedidos,
    evs = [];
  try {
    pedidos = await listarPedidos("comprador", App.conta);
    if (pedidos.length) {
      const ids = pedidos.map((p) => String(p.id));
      const lotes = await Promise.all(
        Object.keys(ROTULO_EVENTO).map((n) => eventos(n, { pedidoId: ids })),
      );
      evs = lotes.flat();
    }
  } catch (e) {
    console.error(e);
    box.innerHTML = vazio("Não foi possível ler o histórico do contrato.");
    return;
  }
  if (id !== renderId) return;
  if (!pedidos.length) {
    box.innerHTML = vazio("Você ainda não tem pedidos para rastrear.");
    return;
  }

  const produtos = await Promise.all(
    pedidos.map((p) => produtoPorId(p.produtoId).catch(() => null)),
  );
  const datas = await Promise.all(
    evs.map((e) => dataDoBloco(e.blockNumber).catch(() => "")),
  );
  evs.forEach((e, i) => {
    e._data = datas[i];
  });
  if (id !== renderId) return;

  const etapa = (feito, titulo, desc) =>
    `<div class="etapa"><div class="icone ${feito ? "feito" : ""}">${feito ? "✓" : "🕓"}</div><strong>${titulo}</strong><br><small>${desc}</small></div>`;

  box.innerHTML = pedidos
    .map((p, i) => {
      const s = Number(p.status);
      const cancelado = s === STATUS.CANCELADO;
      const enviado = s === STATUS.ENVIADO || s === STATUS.ENTREGUE;
      const historico = evs
        .filter((e) => String(e.returnValues.pedidoId) === String(p.id))
        .sort(
          (a, b) =>
            Number(a.blockNumber) - Number(b.blockNumber) ||
            Number(a.logIndex) - Number(b.logIndex),
        )
        .map(
          (
            e,
          ) => `<li><strong>${esc(ROTULO_EVENTO[e.event](e.returnValues))}</strong><br>
         <small>${esc(e._data)} · <a href="${linkTx(e.transactionHash)}" target="_blank" rel="noopener">ver transação ↗</a></small></li>`,
        )
        .join("");
      return `<section class="cartao">
      <div class="linha"><h2>Pedido ${idPedido(p.id)}</h2><span class="selo ${classeStatus(s)}">${STATUS_NOME[s] ?? s}</span></div>
      <div class="etapas">
        ${etapa(true, "Pedido criado", "Pagamento recebido pelo contrato")}
        ${etapa(!cancelado, cancelado ? "Pedido cancelado" : "Pagamento confirmado", cancelado ? "Valor reembolsado" : "Valor retido em custódia")}
        ${etapa(enviado, "Pedido enviado", enviado && p.codigoRastreio ? `Código: ${esc(p.codigoRastreio)}` : "O vendedor informa o código de rastreio")}
        ${etapa(s === STATUS.ENTREGUE, "Entrega confirmada", "O comprador precisa confirmar que recebeu o produto")}
      </div>
      <h3>Detalhes:</h3>
      <p class="espaco">${esc(produtos[i]?.nome ?? "Produto #" + p.produtoId)}<br>${weiParaEth(p.valor)} ETH<br>Vendedor: ${curto(p.vendedor)}</p>
      <h3>Histórico no contrato</h3>
      <ul class="historico">${historico || "<li>Nenhum evento encontrado.</li>"}</ul>
    </section>`;
    })
    .join("");
};
