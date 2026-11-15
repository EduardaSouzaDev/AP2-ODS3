PAGINAS.pedidos = async function paginaPedidos(id) {
  const box = $("#lista-pedidos");
  if (!App.conta) {
    box.innerHTML = pedirConexao();
    return;
  }
  if (!box.children.length) box.innerHTML = vazio("Carregando pedidos…");

  let pedidos,
    hashes = {};
  try {
    pedidos = await listarPedidos("comprador", App.conta);
    hashes = await hashesDeCriacao(App.conta).catch(() => ({}));
  } catch (e) {
    console.error(e);
    box.innerHTML = vazio("Não foi possível ler seus pedidos.");
    return;
  }
  if (id !== renderId) return;
  if (!pedidos.length) {
    box.innerHTML = vazio("Você ainda não fez nenhuma compra.");
    return;
  }

  const produtos = await Promise.all(
    pedidos.map((p) => produtoPorId(p.produtoId).catch(() => null)),
  );
  if (id !== renderId) return;

  box.innerHTML = pedidos
    .map((p, i) => {
      const s = Number(p.status);
      const [txtEntrega, corEntrega] = textoEntrega(p);
      const h = hashes[String(p.id)];
      const acao =
        s === STATUS.ENVIADO
          ? `<button class="botao" data-acao="confirmar" data-id="${p.id}">Confirmar recebimento</button>`
          : s === STATUS.PAGO
            ? `<button class="botao secundario" data-acao="cancelar" data-id="${p.id}">Cancelar pedido</button>`
            : "";
      return `<section class="cartao">
        <div class="linha"><h2>Pedido ${idPedido(p.id)}</h2><span class="selo ${classeStatus(s)}">${STATUS_NOME[s] ?? s}</span></div>
        <p class="espaco"><strong>${esc(produtos[i]?.nome ?? "Produto #" + p.produtoId)}</strong><br>
          ${weiParaEth(p.valor)} ETH<br>Vendedor: ${curto(p.vendedor)}</p>
        <div class="linha"><strong>Pagamento</strong><span class="verde">${s === STATUS.CANCELADO ? "Reembolsado" : "Confirmado"}</span></div>
        <div class="linha"><strong>Entrega</strong><span class="${corEntrega}">${txtEntrega}</span></div>
        ${acao}
      </section>
      ${
        h
          ? `<section class="cartao">
        <h2>Transação blockchain</h2>
        <p class="espaco">Hash da transação<br><span class="hash">${curto(h, 6, 4)}</span></p>
        <p class="verde">Confirmada</p>
        <a class="link" href="${linkTx(h)}" target="_blank" rel="noopener">Visualizar no Sepolia Etherscan ↗</a>
      </section>`
          : ""
      }`;
    })
    .join("");

  box.onclick = async (ev) => {
    const btn = ev.target.closest("[data-acao]");
    if (!btn) return;
    const pid = btn.dataset.id;
    btn.disabled = true;
    const r =
      btn.dataset.acao === "confirmar"
        ? await enviarTx(`Confirmar recebimento ${idPedido(pid)}`, () =>
            App.contrato.methods.confirmarEntrega(pid),
          )
        : await enviarTx(`Cancelar pedido ${idPedido(pid)}`, () =>
            App.contrato.methods.cancelarPedido(pid),
          );
    if (!r) btn.disabled = false;
  };
};
