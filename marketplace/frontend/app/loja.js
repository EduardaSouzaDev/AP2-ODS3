(() => {
  "use strict";

  const lista = document.getElementById("lista-produtos");
  const busca = document.getElementById("busca");
  if (!lista || !busca) return;

  let produtos = [];
  let geracao = 0;
  const comprasPendentes = new Set();

  function elemento(tag, texto, classe) {
    const no = document.createElement(tag);
    if (texto != null) no.textContent = texto;
    if (classe) no.className = classe;
    return no;
  }

  function normalizar(valor) {
    return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function aviso(texto) {
    lista.replaceChildren(elemento("p", texto, "vazio"));
  }

  function imagemProduto(produto) {
    const alternativa = () => elemento("div", "Sem imagem", "sem-imagem");
    let url;
    try {
      url = new URL(produto.imagemURL);
      if (!["http:", "https:"].includes(url.protocol)) return alternativa();
    } catch {
      return alternativa();
    }
    const imagem = document.createElement("img");
    imagem.src = url.href;
    imagem.alt = String(produto.nome);
    imagem.loading = "lazy";
    imagem.referrerPolicy = "no-referrer";
    imagem.addEventListener("error", () => imagem.replaceWith(alternativa()), { once: true });
    return imagem;
  }

  function textoCompra(produto) {
    const App = window.App;
    if (comprasPendentes.has(String(produto.id))) return "Processando compra…";
    if (!produto.ativo) return "Produto inativo";
    if (BigInt(produto.estoque) === 0n) return "Sem estoque";
    if (!App.redeCorreta) return "Selecione a Sepolia";
    if (!App.conta) return "Conecte sua carteira para comprar";
    if (String(produto.vendedor).toLowerCase() === App.conta.toLowerCase()) return "Este produto é seu";
    if (App.pausado) return "Novas compras pausadas";
    return "Comprar 1 unidade";
  }

  function desenhar() {
    const App = window.App;
    if (!App || !App.pronto) return;
    const termo = normalizar(busca.value.trim());
    const filtrados = produtos.filter((produto) =>
      normalizar(`${produto.nome} ${produto.vendedor} ${produto.id}`).includes(termo),
    );
    if (!filtrados.length) {
      aviso(termo ? "Nenhum produto corresponde à sua busca." : "Nenhum produto cadastrado ainda.");
      return;
    }

    const fragmento = document.createDocumentFragment();
    for (const produto of filtrados) {
      const cartao = elemento("article", null, "cartao produto");
      cartao.append(imagemProduto(produto));
      cartao.append(elemento("h3", produto.nome));
      cartao.append(elemento("p", `Produto #${produto.id}`, "dica"));
      const vendedor = elemento("p", `Vendedor: ${App.enderecoCurto(produto.vendedor)}`, "espaco");
      vendedor.title = String(produto.vendedor);
      cartao.append(vendedor);
      cartao.append(elemento("p", `${App.formatarEth(produto.preco)} ETH`, "verde espaco"));
      cartao.append(elemento("p", `Estoque: ${produto.estoque} unidade(s)`));
      cartao.append(elemento("p", produto.ativo ? "Anúncio ativo" : "Anúncio inativo", "dica espaco"));
      const botao = elemento("button", textoCompra(produto), "botao");
      botao.type = "button";
      botao.disabled = !App.conta || !App.pronto || !App.redeCorreta || App.pausado ||
        !produto.ativo || BigInt(produto.estoque) === 0n ||
        String(produto.vendedor).toLowerCase() === String(App.conta).toLowerCase() ||
        comprasPendentes.has(String(produto.id));
      botao.addEventListener("click", () => comprar(produto));
      cartao.append(botao);
      fragmento.append(cartao);
    }
    lista.replaceChildren(fragmento);
  }

  async function comprar(produto) {
    const App = window.App;
    const id = String(produto.id);
    if (comprasPendentes.has(id)) return;
    const conta = App.conta;
    comprasPendentes.add(id);
    desenhar();
    try {
      let atual;
      try {
        if (!App.pronto || !App.redeCorreta || !conta) throw window.App.validacao("Conecte sua carteira à Sepolia antes de comprar.");
        // O preço deve vir novamente do contrato antes de definir o value em wei.
        atual = await App.ler("obterProduto", id);
        if (App.conta !== conta || !App.pronto || !App.redeCorreta) throw window.App.validacao("A conta ou a rede mudou. Confira sua carteira e tente novamente.");
        if (BigInt(atual.preco) !== BigInt(produto.preco)) {
          produtos = produtos.map((item) => String(item.id) === id ? atual : item);
          desenhar();
          throw window.App.validacao("O preço deste produto mudou. Confira o novo valor na loja e clique novamente se desejar comprar.");
        }
        if (!atual.ativo || BigInt(atual.estoque) === 0n) throw window.App.validacao("Este produto não está disponível para compra.");
        if (String(atual.vendedor).toLowerCase() === conta.toLowerCase()) throw window.App.validacao("Você não pode comprar seu próprio produto.");
        if (App.pausado) throw window.App.validacao("O marketplace está pausado para novas compras.");
      } catch (erro) {
        App.mensagem(App.erro(erro), "erro");
        return;
      }
      try {
        await App.enviar("comprar", [id], { value: String(atual.preco) });
      } catch {
        // A camada compartilhada já apresenta a falha ou rejeição ao usuário.
      }
    } finally {
      comprasPendentes.delete(id);
      desenhar();
    }
  }

  async function atualizar() {
    const versao = ++geracao;
    const App = window.App;
    produtos = [];
    if (!App || !App.pronto) {
      aviso(App?.falha || (App?.carregando ? "Conectando ao marketplace…" : !App?.provider ? "Instale a MetaMask para consultar o marketplace." : !App.redeCorreta ? "Selecione a rede Sepolia para consultar os produtos." : "Aguarde a conexão com o contrato."));
      return;
    }
    aviso("Consultando produtos na Sepolia…");
    try {
      const recebidos = await App.listarProdutos();
      if (versao !== geracao || !App.pronto) return;
      produtos = recebidos;
      desenhar();
    } catch (erro) {
      if (versao === geracao) aviso(`Não foi possível carregar os produtos. ${App.erro(erro)}`);
    }
  }

  busca.addEventListener("input", desenhar);
  document.addEventListener("app:estado", atualizar);
  atualizar();
})();
