// Camada compartilhada de conexão, consultas, transações e histórico na Sepolia.
(() => {
  "use strict";

  const CHAVE_SAIR = "criptomarket:desconectado";
  const EXPLORER = "https://sepolia.etherscan.io";
  let versao = 0;
  let conectando = false;
  let saiu = false;
  try { saiu = sessionStorage.getItem(CHAVE_SAIR) === "1"; } catch { /* modo privado */ }

  const App = window.App = {
    web3: null, contrato: null, provider: null, conta: null, saldo: null,
    ehDono: false, redeCorreta: false, pronto: false, pausado: false,
    enviando: false, falha: "", carregando: true,
  };
  const criar = (tag, texto, classe) => {
    const el = document.createElement(tag);
    if (texto != null) el.textContent = texto;
    if (classe) el.className = classe;
    return el;
  };
  const falha = (texto) => Object.assign(new Error(texto), { mensagemUsuario: texto });
  App.validacao = falha;
  const emitir = () => document.dispatchEvent(new CustomEvent("app:estado"));
  const mesmaConta = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  const sepolia = (id) => BigInt(id) === BigInt(SEPOLIA_CHAIN_ID);
  App.enderecoCurto = (endereco) => `${String(endereco).slice(0, 6)}…${String(endereco).slice(-4)}`;
  // Wei e ETH permanecem como BigInt/string para não perder precisão monetária.
  App.formatarEth = (wei) => {
    const valor = BigInt(wei ?? 0);
    const sinal = valor < 0n ? "-" : "";
    const absoluto = valor < 0n ? -valor : valor;
    const fracao = (absoluto % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
    return `${sinal}${absoluto / 10n ** 18n}${fracao ? `.${fracao}` : ""}`;
  };

  const main = document.querySelector("main");
  const banner = criar("div", "Carregando conexão Web3…", "banner");
  banner.id = "banner-web3";
  banner.setAttribute("role", "status");
  main.prepend(banner);
  const atualizarBtn = criar("button", "Atualizar dados", "botao auto");
  atualizarBtn.type = "button";
  atualizarBtn.classList.add("atualizar-dados");
  atualizarBtn.addEventListener("click", () => App.atualizar());
  banner.after(atualizarBtn);
  const avisos = criar("div");
  avisos.id = "avisos";
  avisos.setAttribute("aria-live", "polite");
  document.body.append(avisos);

  App.mensagem = (texto, tipo = "info") => {
    const aviso = criar("div", null, `aviso aviso-${tipo}`);
    aviso.append(criar("span", texto));
    const fechar = criar("button", "×", "fechar-aviso");
    fechar.type = "button";
    fechar.setAttribute("aria-label", "Fechar aviso");
    fechar.addEventListener("click", () => aviso.remove());
    aviso.append(fechar);
    avisos.append(aviso);
    // As transações têm seu próprio painel persistente; avisos podem ser fechados.
    const anteriores = avisos.querySelectorAll(".aviso");
    if (anteriores.length > 3) anteriores[0].remove();
  };

  function desenharBanner() {
    banner.replaceChildren();
    banner.hidden = false;
    atualizarBtn.disabled = App.carregando;
    if (App.carregando) banner.append(criar("span", "Consultando carteira e contrato…"));
    else if (App.falha) banner.append(criar("span", App.falha));
    else if (!App.provider) {
      banner.append(criar("span", "Instale a MetaMask para usar o marketplace."));
      const link = criar("a", "Instalar MetaMask");
      link.href = "https://metamask.io/download/";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      banner.append(link);
    } else if (!App.redeCorreta) {
      banner.append(criar("span", "Selecione a rede de testes Sepolia na MetaMask para continuar."));
      const botao = criar("button", "Trocar para Sepolia", "botao auto");
      botao.type = "button";
      botao.addEventListener("click", () => App.trocarRede());
      banner.append(botao);
    } else if (App.pausado) {
      banner.append(criar("span", "O marketplace está pausado. Novos cadastros e compras estão suspensos; pedidos em andamento e saques continuam disponíveis."));
    } else if (!App.conta) banner.append(criar("span", "Conecte sua carteira para comprar, vender e acompanhar seus pedidos."));
    else banner.hidden = true;
  }
  document.addEventListener("app:estado", desenharBanner);

  const nomesStatus = ["Pago", "Enviado", "Entregue", "Cancelado"];
  const errosContrato = {
    NaoAutorizado: () => "Esta conta não tem permissão para realizar essa ação.",
    ProdutoInexistente: () => "O produto informado não existe.",
    PedidoInexistente: () => "O pedido informado não existe.",
    EstadoInvalido: (args) => `O pedido está ${nomesStatus[Number(args.atual ?? args[0])] || "em outro estado"}; esta ação exige o estado ${nomesStatus[Number(args.esperado ?? args[1])] || "correto"}.`,
    ValorIncorreto: () => "O preço do produto mudou ou o valor enviado está incorreto. Atualize os dados e tente novamente.",
    EstoqueInsuficiente: () => "O produto está inativo ou sem estoque.",
    SaldoInsuficiente: () => "O valor solicitado é maior que o saldo disponível para saque, ou é zero.",
    ContratoPausado: () => "O marketplace está pausado para novas compras e cadastros.",
    TransferenciaFalhou: () => "O contrato não conseguiu transferir o ETH. O saldo permanece disponível para uma nova tentativa.",
  };
  const motivos = {
    "Nome invalido": "Informe um nome de produto com até 80 bytes UTF-8.",
    "Preco deve ser maior que zero": "O preço deve ser maior que zero.",
    "Estoque deve ser maior que zero": "O estoque inicial deve ser maior que zero.",
    "Codigo de rastreio invalido": "Informe um código de rastreio com até 64 bytes UTF-8.",
    "Vendedor nao pode comprar o proprio produto": "Você não pode comprar seu próprio produto.",
  };
  App.erro = (erro) => {
    // MetaMask e Web3.js podem encapsular o mesmo erro em vários níveis.
    const fila = [erro];
    const vistos = new Set();
    const objetos = [];
    const textos = [];
    while (fila.length && vistos.size < 80) {
      const item = fila.shift();
      if (item == null || vistos.has(item)) continue;
      vistos.add(item);
      if (typeof item === "string") {
        textos.push(item);
        if (item.startsWith("{")) { try { fila.push(JSON.parse(item)); } catch { /* texto comum */ } }
      } else if (typeof item === "object") {
        objetos.push(item);
        fila.push(item.message, item.reason, item.data, item.cause, item.innerError, item.originalError, item.error);
        // Alguns RPCs retornam data como { hashDaTransacao: { return: ... } }.
        for (const valor of Object.values(item)) {
          if (typeof valor === "object" || typeof valor === "string") fila.push(valor);
        }
      }
    }
    if (objetos.some((e) => Number(e.code) === 4001 || e.code === "ACTION_REJECTED")) return "Solicitação rejeitada na MetaMask. Nenhuma nova transação foi autorizada.";
    if (objetos.some((e) => Number(e.code) === -32002)) return "Já existe uma solicitação pendente. Abra a MetaMask para responder.";
    if (objetos.some((e) => Number(e.code) === 4902)) return "Ative a exibição de redes de teste na MetaMask, selecione Sepolia e tente novamente.";
    if (objetos.some((e) => [4900, 4901].includes(Number(e.code)))) return "A MetaMask está sem conexão com a rede. Verifique a conexão e atualize os dados.";
    for (const item of objetos) {
      if (item.mensagemUsuario) return item.mensagemUsuario;
      if (errosContrato[item.errorName]) return errosContrato[item.errorName](item.errorArgs || {});
    }
    if (App.web3) {
      for (const texto of textos) {
        if (!/^0x[0-9a-f]{8,}$/i.test(texto)) continue;
        try {
          const abi = CONTRATO_ABI.find((item) => item.type === "error" &&
            App.web3.eth.abi.encodeFunctionSignature(`${item.name}(${item.inputs.map((entrada) => entrada.type).join(",")})`).toLowerCase() === texto.slice(0, 10).toLowerCase());
          if (abi) return errosContrato[abi.name](App.web3.eth.abi.decodeParameters(abi.inputs, `0x${texto.slice(10)}`));
          if (texto.startsWith("0x08c379a0")) {
            const motivo = App.web3.eth.abi.decodeParameters(["string"], `0x${texto.slice(10)}`)[0];
            return motivos[motivo] || `O contrato recusou a operação: ${motivo}`;
          }
        } catch { /* tenta a mensagem textual do RPC */ }
      }
    }
    const texto = textos.join(" ");
    for (const [nome, traduzir] of Object.entries(errosContrato)) if (texto.includes(nome)) return traduzir({});
    for (const [motivo, traducao] of Object.entries(motivos)) if (texto.includes(motivo)) return traducao;
    if (/insufficient funds|insufficient balance|funds for gas/i.test(texto)) return "Saldo de SepoliaETH insuficiente para o valor da compra e a taxa de gas. Obtenha ETH de teste e tente novamente.";
    if (/user denied|user rejected/i.test(texto)) return "Solicitação rejeitada na MetaMask.";
    if (/revert/i.test(texto)) return "O contrato recusou a operação. Atualize os dados e confira o estado do produto ou pedido e a conta conectada.";
    return "Não foi possível concluir a operação. Confira sua conexão, a rede Sepolia e a MetaMask e tente atualizar os dados.";
  };

  App.atualizar = async () => {
    const atual = ++versao;
    Object.assign(App, { pronto: false, contrato: null, ehDono: false, saldo: null, pausado: false, falha: "", carregando: true });
    emitir();
    try {
      if (typeof Web3 === "undefined") throw falha("A biblioteca Web3.js não carregou. Confira sua conexão com a internet e recarregue a página.");
      if (!App.provider) return;
      const [chainId, contas] = await Promise.all([
        App.provider.request({ method: "eth_chainId" }),
        App.provider.request({ method: "eth_accounts" }),
      ]);
      if (atual !== versao) return;
      App.conta = saiu ? null : (contas[0] || null);
      App.redeCorreta = sepolia(chainId);
      if (!App.redeCorreta) return;
      const web3 = new Web3(App.provider);
      App.web3 = web3;
      const codigo = await web3.eth.getCode(CONTRATO_ENDERECO);
      if (atual !== versao) return;
      if (!codigo || /^0x0*$/i.test(codigo)) throw falha("Não há contrato no endereço configurado na Sepolia. Confira o deploy e app/contrato.js com a equipe.");
      const contrato = new web3.eth.Contract(CONTRATO_ABI, CONTRATO_ENDERECO);
      const conta = App.conta;
      const [dono, pausado, saldo] = await Promise.all([
        contrato.methods.dono().call(), contrato.methods.pausado().call(),
        conta ? web3.eth.getBalance(conta) : null,
      ]);
      if (atual !== versao) return;
      Object.assign(App, { contrato, pronto: true, ehDono: !!conta && mesmaConta(conta, dono), pausado: Boolean(pausado), saldo: saldo == null ? null : String(saldo) });
    } catch (erro) {
      if (atual === versao) App.falha = App.erro(erro);
    } finally {
      if (atual === versao) { App.carregando = false; emitir(); }
    }
  };

  App.conectar = async () => {
    if (conectando) return;
    if (!App.provider) { App.mensagem("Instale e habilite a MetaMask neste navegador, depois recarregue a página.", "erro"); return; }
    conectando = true;
    try {
      await App.provider.request({ method: "eth_requestAccounts" });
      saiu = false;
      try { sessionStorage.removeItem(CHAVE_SAIR); } catch { /* modo privado */ }
      await App.atualizar();
    } catch (erro) { App.mensagem(App.erro(erro), "erro"); }
    finally { conectando = false; }
  };
  App.desconectar = () => {
    saiu = true;
    try { sessionStorage.setItem(CHAVE_SAIR, "1"); } catch { /* modo privado */ }
    App.conta = null;
    App.ehDono = false;
    App.mensagem("Carteira desconectada desta aba. As permissões do site podem ser removidas na MetaMask.");
    App.atualizar();
  };
  App.trocarRede = async () => {
    if (!App.provider) return;
    try {
      await App.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
      await App.atualizar();
    } catch (erro) { App.mensagem(App.erro(erro), "erro"); }
  };

  function exigirContrato() {
    if (!App.redeCorreta) throw falha("Selecione a rede Sepolia na MetaMask antes de continuar.");
    if (!App.pronto || !App.contrato) throw falha("Aguarde a conexão com o contrato ou atualize os dados.");
    return App.contrato;
  }
  App.ler = async (nome, ...args) => {
    const contrato = exigirContrato();
    const resultado = await contrato.methods[nome](...args).call(App.conta ? { from: App.conta } : {});
    if (contrato !== App.contrato || !App.pronto) throw falha("A conta ou rede mudou durante a consulta. Atualize os dados.");
    return resultado;
  };
  App.listarProdutos = async () => {
    const total = BigInt(await App.ler("totalProdutos"));
    const produtos = [];
    for (let inicio = 0n; inicio < total; inicio += 50n) produtos.push(...await App.ler("listarProdutos", inicio.toString(), "50"));
    return produtos;
  };
  App.listarPedidos = async (tipo = "comprador", conta = App.conta) => {
    if (!conta) return [];
    const contagem = await App.ler("contarPedidos", conta);
    const indice = tipo === "vendedor" ? 1 : 0;
    const total = BigInt(contagem[indice]);
    const pedidos = [];
    for (let inicio = 0n; inicio < total; inicio += 50n) {
      pedidos.push(...await App.ler(indice ? "listarPedidosDoVendedor" : "listarPedidosDoComprador", conta, inicio.toString(), "50"));
    }
    return pedidos;
  };
  App.buscarEventos = async (nome = "allEvents", filtro = {}) => {
    const contrato = exigirContrato();
    const ultimo = BigInt(await App.web3.eth.getBlockNumber());
    const deploy = BigInt(BLOCO_DEPLOY);
    let inicio = ultimo - 4999n > deploy ? ultimo - 4999n : deploy;
    App.eventosDe = inicio.toString();
    App.eventosAte = ultimo.toString();
    const eventos = [];
    let lote = 500n;
    while (inicio <= ultimo) {
      if (contrato !== App.contrato || !App.pronto) throw falha("A conta ou rede mudou durante a consulta de eventos.");
      const fim = inicio + lote - 1n < ultimo ? inicio + lote - 1n : ultimo;
      try {
        eventos.push(...await contrato.getPastEvents(nome, { filter: filtro, fromBlock: inicio.toString(), toBlock: fim.toString() }));
        inicio = fim + 1n;
      } catch (erro) {
        if (lote <= 1n || !/range|limit|too many|response size|query returned|exceed|block distance/i.test(String(erro.message))) throw erro;
        lote /= 2n;
      }
    }
    if (contrato !== App.contrato || !App.pronto) throw falha("A conta ou rede mudou durante a consulta de eventos.");
    return eventos;
  };

  function painelTransacao(nome) {
    const painel = criar("div", null, "tx");
    painel.setAttribute("role", "status");
    const titulo = criar("strong");
    const detalhe = criar("p", null, "tx-detalhe");
    const link = criar("a");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const fechar = criar("button", "×", "fechar");
    fechar.type = "button";
    fechar.setAttribute("aria-label", "Fechar transação");
    fechar.addEventListener("click", () => painel.remove());
    painel.append(titulo, detalhe, link, fechar);
    avisos.append(painel);
    return (estado, texto, hash) => {
      painel.className = `tx tx-${estado}`;
      titulo.textContent = `${nome} — ${estado}`;
      detalhe.textContent = texto;
      if (hash) { link.textContent = hash; link.href = `${EXPLORER}/tx/${hash}`; }
    };
  }

  App.enviar = async (nome, args = [], opcoes = {}) => {
    let mostrar;
    let hash;
    let recibo;
    // O bloqueio evita duas janelas de assinatura disparadas pelo mesmo clique.
    if (App.enviando) { const erro = falha("Já há uma transação em andamento. Aguarde sua confirmação."); App.mensagem(erro.message, "erro"); throw erro; }
    App.enviando = true;
    try {
      const contrato = exigirContrato();
      const conta = App.conta;
      const contexto = versao;
      if (!conta) throw falha("Conecte sua carteira antes de enviar uma transação.");
      const definicao = CONTRATO_ABI.find((item) => item.type === "function" && item.name === nome && !["view", "pure"].includes(item.stateMutability));
      if (!definicao) throw falha("A função solicitada não é uma transação do contrato.");
      const valor = BigInt(opcoes.value ?? 0);
      if (valor < 0n || (valor > 0n && definicao.stateMutability !== "payable")) throw falha("Esta operação não aceita o valor de ETH informado.");
      const verificarContexto = async () => {
        const [chain, contas] = await Promise.all([
          App.provider.request({ method: "eth_chainId" }), App.provider.request({ method: "eth_accounts" }),
        ]);
        if (!sepolia(chain) || !mesmaConta(contas[0], conta) || !mesmaConta(App.conta, conta) || saiu || contexto !== versao || contrato !== App.contrato) {
          throw falha("A conta ou a rede mudou. Confira a MetaMask e tente a operação novamente.");
        }
      };
      await verificarContexto();
      mostrar = painelTransacao(nome);
      mostrar("pendente", "Validando a operação e estimando a taxa de gas…");
      const metodo = contrato.methods[nome](...args);
      const transacao = { from: conta, value: valor.toString() };
      // Simulação captura erros de negócio antes de pedir a assinatura.
      await metodo.call(transacao);
      const [estimativa, saldo, precoGas] = await Promise.all([
        metodo.estimateGas(transacao), App.web3.eth.getBalance(conta), App.web3.eth.getGasPrice(),
      ]);
      const gas = (BigInt(estimativa) * 120n + 99n) / 100n;
      if (BigInt(saldo) < valor + gas * BigInt(precoGas)) throw falha("Saldo de SepoliaETH insuficiente para o valor e a estimativa de gas. Obtenha ETH de teste e tente novamente.");
      await verificarContexto();
      mostrar("pendente", "Confirme a transação na MetaMask.");
      recibo = await metodo.send({ ...transacao, gas: gas.toString(), chainId: SEPOLIA_CHAIN_ID })
        .on("transactionHash", (txHash) => { hash = txHash; mostrar("pendente", "Aguardando inclusão em um bloco da Sepolia…", hash); })
        .on("error", () => { /* a rejeição da Promise é tratada abaixo */ });
      hash = recibo.transactionHash || hash;
      if (BigInt(recibo.status) !== 1n) throw Object.assign(falha("A transação foi incluída em um bloco, mas o contrato recusou a execução."), { receipt: recibo });
      mostrar("confirmada", `Incluída no bloco ${recibo.blockNumber}.`, hash);
      await App.atualizar();
      if (App.falha) App.mensagem("A transação foi confirmada, mas os dados não puderam ser recarregados. Use Atualizar dados.", "erro");
      return recibo;
    } catch (erro) {
      recibo = recibo || erro.receipt;
      hash = hash || recibo?.transactionHash;
      const texto = App.erro(erro);
      if (hash && !recibo) {
        mostrar?.("pendente", "Não foi possível confirmar o resultado. Acompanhe a transação no Etherscan antes de tentar novamente.", hash);
      } else if (mostrar) mostrar("falhou", texto, hash);
      else App.mensagem(texto, "erro");
      throw erro;
    } finally { App.enviando = false; }
  };

  async function detectarMetaMask() {
    let anunciado;
    const receber = (evento) => {
      if (evento.detail?.info?.rdns === "io.metamask") anunciado = evento.detail.provider;
    };
    window.addEventListener("eip6963:announceProvider", receber);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    window.removeEventListener("eip6963:announceProvider", receber);
    const injetado = window.ethereum;
    return anunciado || injetado?.providers?.find((p) => p.isMetaMask) || (injetado?.isMetaMask ? injetado : null);
  }
  async function iniciar() {
    if (typeof Web3 === "undefined") {
      App.carregando = false;
      App.falha = "A biblioteca Web3.js não carregou. Confira sua conexão com a internet e recarregue a página.";
      emitir();
      return;
    }
    App.provider = await detectarMetaMask();
    if (App.provider?.on) {
      const mudou = () => {
        // Invalida imediatamente permissões e leituras pendentes, antes de consultar a nova conta/rede.
        App.conta = null;
        App.redeCorreta = false;
        App.atualizar();
      };
      App.provider.on("accountsChanged", mudou);
      App.provider.on("chainChanged", mudou);
      App.provider.on("connect", mudou);
      App.provider.on("disconnect", () => {
        ++versao;
        Object.assign(App, { pronto: false, conta: null, contrato: null, ehDono: false, saldo: null, redeCorreta: false, carregando: false, falha: "A MetaMask perdeu a conexão. Verifique a rede e atualize os dados." });
        emitir();
      });
    }
    await App.atualizar();
  }
  iniciar().catch((erro) => { App.carregando = false; App.falha = App.erro(erro); emitir(); });
})();
