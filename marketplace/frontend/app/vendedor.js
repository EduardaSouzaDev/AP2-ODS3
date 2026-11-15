const IMG_MAX_CHARS = 6000;

function carregarImagem(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      falha(
        erroAmigavel(
          "Não foi possível ler essa imagem. Use um arquivo JPG, PNG ou WebP.",
        ),
      );
    };
    img.src = url;
  });
}

async function prepararFoto(arquivo) {
  if (!arquivo.type.startsWith("image/"))
    throw erroAmigavel("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  if (arquivo.size > 15 * 1024 * 1024)
    throw erroAmigavel("A imagem é muito grande. Escolha uma de até 15 MB.");

  const img = await carregarImagem(arquivo);
  for (const lado of [240, 200, 160, 120, 96]) {
    const fator = Math.min(1, lado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * fator));
    const h = Math.max(1, Math.round(img.height * fator));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // PNG transparente vira fundo branco no JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const qualidade of [0.7, 0.55, 0.4, 0.3]) {
      const dataUrl = canvas.toDataURL("image/jpeg", qualidade);
      if (dataUrl.length <= IMG_MAX_CHARS) return dataUrl;
    }
  }
  throw erroAmigavel(
    "Não foi possível reduzir esta imagem o bastante para a blockchain. Tente uma foto mais simples.",
  );
}

/* Página */

let fotoAtual = ""; // URL da foto já reduzida

function limparFoto() {
  fotoAtual = "";
  $("#prod-foto").value = "";
  $("#foto-previa").hidden = true;
}

function ligarFormularioProduto() {
  $("#btn-foto").onclick = () => $("#prod-foto").click();

  $("#prod-foto").onchange = async (ev) => {
    const arquivo = ev.target.files[0];
    if (!arquivo) return;
    try {
      fotoAtual = await prepararFoto(arquivo);
      $("#foto-img").src = fotoAtual;
      $("#foto-info").textContent =
        `${arquivo.name} — ${(fotoAtual.length / 1024).toFixed(1)} KB serão gravados na blockchain`;
      $("#foto-previa").hidden = false;
    } catch (e) {
      limparFoto();
      aviso("erro", traduzirErro(e));
    }
  };

  $("#form-produto").onsubmit = async (ev) => {
    ev.preventDefault();
    const nome = $("#prod-nome").value.trim();
    const preco = ethParaWei($("#prod-preco").value);
    const estoque = Number($("#prod-estoque").value);
    if (!nome) return aviso("erro", "Informe o nome do produto.");
    if (!preco)
      return aviso("erro", "Informe um preço válido em ETH (ex.: 0.05).");
    if (!Number.isInteger(estoque) || estoque < 1)
      return aviso(
        "erro",
        "O estoque deve ser um número inteiro maior que zero.",
      );
    const r = await enviarTx("Cadastrar produto", () =>
      App.contrato.methods.cadastrarProduto(nome, fotoAtual, preco, estoque),
    );
    if (r) {
      $("#form-produto").reset();
      limparFoto();
    }
  };
}

PAGINAS.vendedor = async function paginaVendedor(id) {
  const area = $("#area-vendedor");
  const acesso = $("#acesso");
  if (!App.conta) {
    area.hidden = true;
    acesso.hidden = false;
    acesso.innerHTML = pedirConexao();
    return;
  }
  acesso.hidden = true;
  area.hidden = false;
  ligarFormularioProduto();

  let meus = [],
    pedidos = [],
    saldoContrato = "0",
    maxRastreio = 64;
  try {
    const c = lerC();
    const [todos, ped, saldo, max] = await Promise.all([
      listarTodosProdutos(),
      listarPedidos("vendedor", App.conta),
      c.methods.saldos(App.conta).call(),
      c.methods.MAX_RASTREIO().call(),
    ]);
    meus = todos.filter((p) => mesmoEndereco(p.vendedor, App.conta));
    pedidos = ped.filter((p) => Number(p.status) === STATUS.PAGO);
    saldoContrato = saldo;
    maxRastreio = Number(max);
  } catch (e) {
    console.error(e);
    aviso("erro", "Não foi possível ler os dados do vendedor no contrato.");
    return;
  }
  if (id !== renderId) return;

  /* Pedidos aguardando envio */
  const boxPed = $("#pedidos-envio");
  const produtos = await Promise.all(
    pedidos.map((p) => produtoPorId(p.produtoId).catch(() => null)),
  );
  if (id !== renderId) return;
  boxPed.innerHTML = pedidos.length
    ? pedidos
        .map(
          (p, i) => `
    <div class="cartao" data-pedido="${p.id}">
      <h2>Pedido ${idPedido(p.id)}</h2>
      <p class="espaco"><strong>${esc(produtos[i]?.nome ?? "Produto #" + p.produtoId)}</strong><br>
        ${weiParaEth(p.valor)} ETH<br>Comprador: ${curto(p.comprador)}</p>
      <div class="campo"><label>Código de Rastreio:</label>
        <input data-campo="codigo" maxlength="${maxRastreio}" placeholder="Ex.: BR123456789BR"></div>
      <button class="botao auto" data-acao="enviar">Marcar como enviado</button>
    </div>`,
        )
        .join("")
    : vazio("Nenhum pedido aguardando envio.");

  boxPed.onclick = async (ev) => {
    const btn = ev.target.closest('[data-acao="enviar"]');
    if (!btn) return;
    const card = btn.closest("[data-pedido]");
    const codigo = $('[data-campo="codigo"]', card).value.trim();
    if (!codigo)
      return aviso(
        "erro",
        "Informe o código de rastreio antes de marcar como enviado.",
      );
    btn.disabled = true;
    const r = await enviarTx(
      `Marcar ${idPedido(card.dataset.pedido)} como enviado`,
      () => App.contrato.methods.marcarEnviado(card.dataset.pedido, codigo),
    );
    if (!r) btn.disabled = false;
  };

  /* Saldo / saque */
  $("#saldo-contrato").textContent = `${weiParaEth(saldoContrato)} ETH`;
  const btnSacar = $("#btn-sacar");
  btnSacar.disabled = BigInt(saldoContrato) === 0n;
  btnSacar.onclick = async () => {
    btnSacar.disabled = true;
    const r = await enviarTx("Sacar saldo", () =>
      App.contrato.methods.sacar(saldoContrato),
    );
    if (!r) btnSacar.disabled = false;
  };

  /* Meus produtos (editar preço, estoque e visibilidade) */
  const boxProd = $("#meus-produtos");
  boxProd.innerHTML = meus.length
    ? meus
        .map(
          (p) => `
    <div class="cartao" data-produto="${p.id}">
      <div class="linha"><strong>${esc(p.nome)}</strong><span class="${p.ativo ? "verde" : "vermelho"}">${p.ativo ? "Ativo" : "Inativo"}</span></div>
      <div class="grade-campos">
        <div class="campo"><label>Preço (ETH)</label><input data-campo="preco" value="${weiParaEth(p.preco)}"></div>
        <div class="campo"><label>Estoque</label><input data-campo="estoque" type="number" min="0" value="${p.estoque}"></div>
        <label class="check"><input type="checkbox" data-campo="ativo" ${p.ativo ? "checked" : ""}> Ativo na loja</label>
      </div>
      <button class="botao auto" data-acao="salvar-produto">Salvar alterações</button>
    </div>`,
        )
        .join("")
    : vazio("Você ainda não cadastrou produtos.");

  boxProd.onclick = async (ev) => {
    const btn = ev.target.closest('[data-acao="salvar-produto"]');
    if (!btn) return;
    const card = btn.closest("[data-produto]");
    const preco = ethParaWei($('[data-campo="preco"]', card).value);
    const estoque = Number($('[data-campo="estoque"]', card).value);
    const ativo = $('[data-campo="ativo"]', card).checked;
    if (!preco) return aviso("erro", "Informe um preço válido em ETH.");
    if (!Number.isInteger(estoque) || estoque < 0)
      return aviso(
        "erro",
        "O estoque deve ser um inteiro igual ou maior que zero.",
      );
    btn.disabled = true;
    const r = await enviarTx("Atualizar produto", () =>
      App.contrato.methods.atualizarProduto(
        card.dataset.produto,
        preco,
        estoque,
        ativo,
      ),
    );
    if (!r) btn.disabled = false;
  };
};
