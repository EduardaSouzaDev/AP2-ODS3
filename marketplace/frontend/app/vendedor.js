(() => {
  "use strict";
  if (document.body.dataset.pagina !== "vendedor") return;

  const $ = (id) => document.getElementById(id);
  const limiteUint = (1n << 256n) - 1n;
  const estados = ["Pago — aguardando envio", "Enviado", "Entregue", "Cancelado"];
  let geracao = 0;
  let carregando = false;
  let recarregar = false;
  let enviando = false;
  let dadosProntos = false;
  let saldoDisponivel = "0";
  let contaExibida = null;
  let contratoExibido = null;

  function elemento(tag, texto, classe) {
    const node = document.createElement(tag);
    if (texto != null) node.textContent = texto;
    if (classe) node.className = classe;
    return node;
  }

  function campo(form, titulo, id, valor, tipo = "text") {
    const grupo = elemento("div", null, "campo");
    const label = elemento("label", titulo);
    label.htmlFor = id;
    const input = elemento("input");
    input.id = id;
    input.type = tipo;
    input.value = valor;
    grupo.append(label, input);
    form.append(grupo);
    return input;
  }

  function inteiro(valor, nome, minimo = 0n) {
    const texto = String(valor).trim();
    if (!/^\d+$/.test(texto)) throw window.App.validacao(`${nome} deve ser um número inteiro.`);
    const numero = BigInt(texto);
    if (numero < minimo || numero > limiteUint) {
      throw window.App.validacao(`${nome} está fora do intervalo permitido.`);
    }
    return numero.toString();
  }

  function precoEmWei(valor) {
    const texto = valor.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,18})?$/.test(texto)) {
      throw window.App.validacao("Informe o preço em ETH, com até 18 casas decimais.");
    }
    return inteiro(window.App.web3.utils.toWei(texto, "ether"), "Preço", 1n);
  }

  function avisar(error) {
    window.App.mensagem(window.App.erro(error), "erro");
  }

  function podeAgir() {
    return window.App?.pronto && window.App.conta;
  }

  function bloquear() {
    const app = window.App;
    $("area-vendedor").querySelectorAll("button").forEach((botao) => {
      botao.disabled = enviando || !dadosProntos || !podeAgir() || (botao.dataset.cadastro === "true" && app.pausado);
    });
    $("btn-sacar").disabled = enviando || !dadosProntos || !podeAgir() || BigInt(saldoDisponivel) === 0n;
  }

  async function transacionar(nome, args, depois) {
    if (enviando || !dadosProntos || !podeAgir()) return;
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

  function desenharProdutos(produtos) {
    const lista = $("meus-produtos");
    lista.replaceChildren();
    if (!produtos.length) {
      lista.append(elemento("p", "Você ainda não cadastrou produtos.", "vazio"));
      return;
    }
    for (const produto of produtos) {
      const cartao = elemento("article", null, "cartao");
      cartao.append(elemento("h3", `#${produto.id} — ${produto.nome}`));
      const form = elemento("form");
      form.noValidate = true;
      const preco = campo(form, "Preço em ETH", `preco-${produto.id}`, window.App.formatarEth(produto.preco));
      preco.inputMode = "decimal";
      const estoque = campo(form, "Estoque", `estoque-${produto.id}`, String(produto.estoque));
      estoque.inputMode = "numeric";
      const rotulo = elemento("label", null, "check");
      const ativo = elemento("input");
      ativo.type = "checkbox";
      ativo.checked = produto.ativo === true || produto.ativo === "true";
      rotulo.append(ativo, document.createTextNode("Disponível na loja"));
      const salvar = elemento("button", "Salvar alterações", "botao auto");
      salvar.type = "submit";
      form.append(rotulo, salvar);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        let args;
        try {
          args = [String(produto.id), precoEmWei(preco.value), inteiro(estoque.value, "Estoque"), ativo.checked];
        } catch (error) {
          avisar(error);
          return;
        }
        void transacionar("atualizarProduto", args);
      });
      cartao.append(form);
      lista.append(cartao);
    }
  }

  function desenharPedidos(pedidos, produtos) {
    const lista = $("pedidos-envio");
    lista.replaceChildren();
    const nomes = new Map(produtos.map((produto) => [String(produto.id), produto.nome]));
    if (!pedidos.length) {
      lista.append(elemento("p", "Você ainda não recebeu pedidos.", "vazio"));
      return;
    }
    for (const pedido of [...pedidos].reverse()) {
      const status = String(pedido.status);
      const cartao = elemento("article", null, "cartao");
      cartao.append(
        elemento("h3", `Pedido #${pedido.id} — ${nomes.get(String(pedido.produtoId)) || `Produto #${pedido.produtoId}`}`),
        elemento("p", `Comprador: ${pedido.comprador}`, "hash espaco"),
        elemento("p", `Valor: ${window.App.formatarEth(pedido.valor)} ETH`),
        elemento("p", `Estado: ${estados[status] || "Desconhecido"}`, "espaco"),
      );
      if (pedido.codigoRastreio) cartao.append(elemento("p", `Rastreio: ${pedido.codigoRastreio}`));
      if (status === "0") {
        const form = elemento("form");
        form.noValidate = true;
        const codigo = campo(form, "Código de rastreio", `rastreio-${pedido.id}`, "");
        codigo.maxLength = 64;
        const enviar = elemento("button", "Registrar envio", "botao auto");
        enviar.type = "submit";
        form.append(enviar);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const texto = codigo.value.trim();
          const tamanho = new TextEncoder().encode(texto).length;
          if (!tamanho || tamanho > 64) {
            avisar(window.App.validacao("Informe um código de rastreio de até 64 bytes."));
            return;
          }
          void transacionar("marcarEnviado", [String(pedido.id), texto]);
        });
        const cancelar = elemento("button", "Cancelar pedido e creditar reembolso", "botao auto secundario");
        cancelar.type = "button";
        cancelar.addEventListener("click", () => void transacionar("cancelarPedido", [String(pedido.id)]));
        cartao.append(form, cancelar);
      }
      lista.append(cartao);
    }
  }

  async function atualizar() {
    const minhaGeracao = ++geracao;
    const app = window.App;
    const disponivel = Boolean(app?.pronto && app.conta);
    dadosProntos = false;
    $("acesso").hidden = disponivel;
    $("area-vendedor").hidden = !disponivel;
    if (!disponivel) {
      $("acesso").textContent = "Conecte sua carteira à rede Sepolia para acessar o painel.";
      saldoDisponivel = "0";
      contaExibida = null;
      contratoExibido = null;
      recarregar = false;
      return;
    }
    if (contaExibida !== app.conta || contratoExibido !== app.contrato) {
      contaExibida = app.conta;
      contratoExibido = app.contrato;
      saldoDisponivel = "0";
      $("saldo-contrato").textContent = "Carregando…";
      $("meus-produtos").replaceChildren(elemento("p", "Carregando produtos…", "vazio"));
      $("pedidos-envio").replaceChildren(elemento("p", "Carregando pedidos…", "vazio"));
    }
    bloquear();
    if (carregando) {
      recarregar = true;
      return;
    }
    carregando = true;
    const conta = app.conta;
    const contrato = app.contrato;
    try {
      const [produtos, pedidos, saldo] = await Promise.all([
        app.listarProdutos(),
        app.listarPedidos("vendedor", conta),
        app.ler("saldos", conta),
      ]);
      if (minhaGeracao !== geracao || app.conta !== conta || app.contrato !== contrato || !app.pronto) return;
      saldoDisponivel = String(saldo);
      $("saldo-contrato").textContent = `${app.formatarEth(saldo)} ETH`;
      desenharProdutos(produtos.filter((produto) => produto.vendedor.toLowerCase() === conta.toLowerCase()));
      desenharPedidos(pedidos, produtos);
      dadosProntos = true;
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

  $("form-produto").querySelector("button[type=submit]").dataset.cadastro = "true";
  $("pedidos-envio").previousElementSibling.textContent = "Pedidos recebidos";
  $("form-produto").addEventListener("submit", (event) => {
    event.preventDefault();
    let args;
    try {
      const nome = $("prod-nome").value.trim();
      const tamanho = new TextEncoder().encode(nome).length;
      if (!tamanho || tamanho > 80) throw window.App.validacao("O nome precisa ter entre 1 e 80 bytes (acentos ocupam mais de um byte).");
      let imagem = $("prod-imagem").value.trim();
      if (imagem) {
        let url;
        try { url = new URL(imagem); } catch { throw window.App.validacao("Informe uma URL de imagem válida ou deixe o campo vazio."); }
        if (!["http:", "https:"].includes(url.protocol)) throw window.App.validacao("A imagem deve usar uma URL HTTP ou HTTPS.");
        imagem = url.href;
      }
      args = [nome, imagem, precoEmWei($("prod-preco").value), inteiro($("prod-estoque").value, "Estoque", 1n)];
    } catch (error) {
      avisar(error);
      return;
    }
    void transacionar("cadastrarProduto", args, () => $("form-produto").reset());
  });
  $("btn-sacar").addEventListener("click", () => {
    if (BigInt(saldoDisponivel) > 0n) void transacionar("sacar", [saldoDisponivel]);
  });
  document.addEventListener("app:estado", () => void atualizar());
  void atualizar();
})();
