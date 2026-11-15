PAGINAS.admin = async function paginaAdmin(id) {
  const area = $("#area-admin");
  const acesso = $("#acesso");
  if (!App.conta) {
    area.hidden = true;
    acesso.hidden = false;
    acesso.innerHTML = pedirConexao();
    return;
  }
  if (!App.ehDono) {
    area.hidden = true;
    acesso.hidden = false;
    acesso.innerHTML = `<div class="cartao"><h2>Acesso restrito</h2>
      <p class="espaco">Esta área é exclusiva do proprietário do contrato${App.dono ? ` (${curto(App.dono)})` : ""}.
      Você está conectado como ${curto(App.conta)}.</p></div>`;
    return;
  }
  acesso.hidden = true;
  area.hidden = false;

  let dados;
  try {
    const c = lerC();
    const [bps, den, pausado, tp, tped, custodia] = await Promise.all([
      c.methods.TAXA_BPS().call(),
      c.methods.BPS_DENOMINADOR().call(),
      c.methods.pausado().call(),
      c.methods.totalProdutos().call(),
      c.methods.totalPedidos().call(),
      c.methods.totalEmCustodia().call(),
    ]);
    dados = { bps, den, pausado, tp, tped, custodia };
  } catch (e) {
    console.error(e);
    aviso("erro", "Não foi possível ler os dados administrativos.");
    return;
  }
  if (id !== renderId) return;

  const taxa = (Number(dados.bps) / Number(dados.den)) * 100;
  $("#taxa-valor").textContent =
    `${taxa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  $("#total-produtos").textContent = dados.tp;
  $("#total-pedidos").textContent = dados.tped;
  $("#total-custodia").textContent = `${weiParaEth(dados.custodia)} ETH`;
  $("#estado-pausa").textContent = dados.pausado ? "Pausado" : "Ativo";
  $("#estado-pausa").className = dados.pausado ? "vermelho" : "verde";

  const btnPausa = $("#btn-pausa");
  btnPausa.textContent = dados.pausado ? "Retomar contrato" : "Pausar contrato";
  btnPausa.onclick = async () => {
    btnPausa.disabled = true;
    const r = await enviarTx(
      dados.pausado ? "Retomar contrato" : "Pausar contrato",
      () => App.contrato.methods.definirPausa(!dados.pausado),
    );
    if (!r) btnPausa.disabled = false;
  };

  $("#form-disputa").onsubmit = async (ev) => {
    ev.preventDefault();
    const pid = Number($("#disputa-id").value);
    const favor = $("#disputa-favor").value === "comprador";
    if (!Number.isInteger(pid) || pid < 1)
      return aviso("erro", "Informe um número de pedido válido.");
    const r = await enviarTx(`Resolver disputa ${idPedido(pid)}`, () =>
      App.contrato.methods.resolverDisputa(pid, favor),
    );
    if (r) $("#form-disputa").reset();
  };

  /* Histórico geral de eventos */
  const lista = $("#feed-eventos");
  try {
    const evs = (await eventos("allEvents"))
      .sort(
        (a, b) =>
          Number(b.blockNumber) - Number(a.blockNumber) ||
          Number(b.logIndex) - Number(a.logIndex),
      )
      .slice(0, 15);
    const datas = await Promise.all(
      evs.map((e) => dataDoBloco(e.blockNumber).catch(() => "")),
    );
    if (id !== renderId) return;
    lista.innerHTML = evs.length
      ? evs
          .map((e, i) => {
            const rv = e.returnValues;
            const ref =
              rv.pedidoId !== undefined
                ? `pedido ${idPedido(rv.pedidoId)}`
                : rv.produtoId !== undefined
                  ? `produto ${rv.produtoId}`
                  : "";
            return `<li><strong>${esc(e.event)}</strong> ${esc(ref)}<br>
        <small>${esc(datas[i])} · <a href="${linkTx(e.transactionHash)}" target="_blank" rel="noopener">ver transação ↗</a></small></li>`;
          })
          .join("")
      : "<li>Nenhum evento registrado ainda.</li>";
  } catch (e) {
    console.error(e);
    lista.innerHTML = "<li>Não foi possível carregar os eventos.</li>";
  }
};
