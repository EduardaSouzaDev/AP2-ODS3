/*MUDAR PARA .env*/
const RPC_SEPOLIA = 'https://ethereum-sepolia-rpc.publicnode.com';
const ETHERSCAN = 'https://sepolia.etherscan.io';
const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Sepolia',
  nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: [RPC_SEPOLIA],
  blockExplorerUrls: [ETHERSCAN]
};

// Confirmar esta ordem com o enum StatusPedido do MeuDApp.sol
const STATUS = { PAGO: 0, ENVIADO: 1, ENTREGUE: 2, CANCELADO: 3, DISPUTA: 4 };
const STATUS_NOME = ['Pago', 'Enviado', 'Entregue', 'Cancelado', 'Em disputa'];

const App = (window.App = {
  web3: null,            
  contrato: null,        
  leitor: null,          
  contratoLeitura: null,
  conta: null,
  saldo: null,          
  chainId: null,
  naSepolia: false,
  dono: null,
  ehDono: false,
  pausado: false
});

const PAGINAS = {};
let renderId = 0;        // descarta renderizações antigas quando o estado muda rápido

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const curto = (a, i = 5, f = 4) => (a ? `${a.slice(0, i)}...${a.slice(-f)}` : '');
const weiParaEth = (wei) => Web3.utils.fromWei(String(wei), 'ether');
const idPedido = (id) => '#' + String(id).padStart(3, '0');
const mesmoEndereco = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const linkTx = (h) => `${ETHERSCAN}/tx/${h}`;

const imgSegura = (u) => (/^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(u || '') ? u : '');

function ethParaWei(txt) {
  const t = String(txt).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,18})?$/.test(t) || Number(t) <= 0) return null;
  return Web3.utils.toWei(t, 'ether');
}

const lerC = () => (App.contrato && App.naSepolia ? App.contrato : App.contratoLeitura);
 
function criarContainers() {
  const banner = document.createElement('div');
  banner.id = 'banner-rede';
  banner.className = 'banner';
  banner.hidden = true;
  ($('.pagina') || document.body).prepend(banner);

  const avisos = document.createElement('div');
  avisos.id = 'avisos';
  avisos.innerHTML = '<div id="painel-tx" class="tx" hidden></div>';
  document.body.appendChild(avisos);
}

function aviso(tipo, texto, ms = 7000) {
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.textContent = texto;
  $('#avisos').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function atualizarBanner() {
  const b = $('#banner-rede');
  let html = '';
  if (!window.ethereum) {
    html = '<span>MetaMask não encontrada. Instale a extensão para conectar sua carteira.</span>';
  } else if (App.chainId && !App.naSepolia) {
    html = '<span>⚠️ Você está em outra rede. Este app funciona na <strong>Sepolia</strong>.</span>' +
           '<button class="botao-mini" id="btn-trocar-rede">Trocar para Sepolia</button>';
  } else if (App.pausado) {
    html = '<span>⏸️ O contrato está pausado pelo administrador. Compras e envios estão bloqueados por enquanto.</span>';
  }
  b.hidden = !html;
  b.innerHTML = html;
  const t = $('#btn-trocar-rede');
  if (t) t.onclick = trocarParaSepolia;
}

function painelTx(hash, estado, rotulo, detalhe) {
  const el = $('#painel-tx');
  const nome = { pendente: '⏳ Pendente', confirmada: '✅ Confirmada', falhou: '❌ Falhou' }[estado];
  el.hidden = false;
  el.className = `tx tx-${estado}`;
  el.innerHTML =
    `<button class="fechar" aria-label="Fechar">×</button>
     <strong>${esc(rotulo)}</strong>
     <div>${nome}</div>
     ${hash ? `<div>Hash: <a href="${linkTx(hash)}" target="_blank" rel="noopener">${curto(hash, 6, 4)} ↗</a></div>` : ''}
     ${detalhe ? `<div class="tx-detalhe">${esc(detalhe)}</div>` : ''}`;
  $('.fechar', el).onclick = () => { el.hidden = true; };
}

const vazio = (txt) => `<p class="vazio">${esc(txt)}</p>`;

const pedirConexao = () =>
  `<div class="cartao vazio-conectar"><p>Conecte sua carteira para ver esta página.</p>
   <button class="botao auto" data-conectar>Conectar Carteira</button></div>`;

function classeStatus(s) {
  s = Number(s);
  return s === STATUS.CANCELADO || s === STATUS.DISPUTA ? 'vermelho' : s === STATUS.PAGO ? 'amarelo' : '';
}

function textoEntrega(p) {
  const s = Number(p.status);
  if (s === STATUS.PAGO) return ['Aguardando envio', 'vermelho'];
  if (s === STATUS.ENVIADO) return [`Enviado${p.codigoRastreio ? ' — ' + esc(p.codigoRastreio) : ''}`, 'verde'];
  if (s === STATUS.ENTREGUE) return ['Entregue', 'verde'];
  if (s === STATUS.CANCELADO) return ['Cancelado', 'vermelho'];
  return ['Em disputa', 'vermelho'];
}

/* Tradução de erros*/
const erroAmigavel = (msg) => Object.assign(new Error(msg), { amigavel: true });

let _erros = null;
function errosDoContrato() {
  if (_erros) return _erros;
  const abi = new Web3().eth.abi;
  _erros = CONTRATO_ABI.filter((x) => x.type === 'error').map((x) => ({
    nome: x.name,
    inputs: x.inputs,
    sel: abi.encodeFunctionSignature(`${x.name}(${x.inputs.map((i) => i.type).join(',')})`).toLowerCase()
  }));
  return _erros;
}

function acharHex(e, n = 0, vistos = new Set()) {
  if (!e || typeof e !== 'object' || n > 6 || vistos.has(e)) return null;
  vistos.add(e);
  for (const k of ['data', 'originalError', 'error', 'cause', 'innerError']) {
    const v = e[k];
    if (typeof v === 'string' && /^0x[0-9a-fA-F]{8,}$/.test(v)) return v;
    const r = acharHex(v, n + 1, vistos);
    if (r) return r;
  }
  return null;
}

function textoErro(e, n = 0) {
  if (!e || n > 5) return '';
  return [e.message, textoErro(e.cause, n + 1), textoErro(e.innerError, n + 1), textoErro(e.error, n + 1)]
    .filter(Boolean).join(' | ');
}

function mensagemContrato(nome, a) {
  const eth = (v) => `${weiParaEth(v)} ETH`;
  const msgs = {
    ContratoPausado: () => 'O contrato está pausado pelo administrador. Tente novamente mais tarde.',
    EstadoInvalido: () => `Esta ação não é permitida no estado atual do pedido (atual: ${STATUS_NOME[Number(a.atual)] ?? a.atual}, esperado: ${STATUS_NOME[Number(a.esperado)] ?? a.esperado}).`,
    EstoqueInsuficiente: () => 'Este produto está sem estoque.',
    NaoAutorizado: () => 'Esta conta não tem permissão para realizar esta ação.',
    PedidoInexistente: () => `O pedido ${idPedido(a.pedidoId)} não existe.`,
    ProdutoInexistente: () => `O produto ${a.produtoId} não existe.`,
    SaldoInsuficiente: () => `Saldo insuficiente no contrato: disponível ${eth(a.disponivel)}, solicitado ${eth(a.solicitado)}.`,
    TransferenciaFalhou: () => 'A transferência de ETH falhou. Tente novamente.',
    ValorIncorreto: () => `Valor incorreto: o esperado era ${eth(a.esperado)} e foram enviados ${eth(a.enviado)}.`
  };
  return (msgs[nome] || (() => `O contrato recusou a operação (${nome}).`))();
}

function traduzirErro(e) {
  if (e?.amigavel) return e.message;
  const txt = textoErro(e);
  const cod = e?.code ?? e?.cause?.code ?? e?.error?.code;

  if (cod === 4001 || /user (denied|rejected)|rejected the request|ACTION_REJECTED/i.test(txt)) {
    return 'Você rejeitou a transação na MetaMask. Nada foi cobrado.';
  }
  const hex = acharHex(e) || (txt.match(/0x[0-9a-fA-F]{8,}/) || [])[0];
  if (hex) {
    const def = errosDoContrato().find((x) => x.sel === hex.slice(0, 10).toLowerCase());
    if (def) {
      let args = {};
      try {
        if (def.inputs.length) args = new Web3().eth.abi.decodeParameters(def.inputs, '0x' + hex.slice(10));
      } catch (_) { /* usa args vazio */ }
      return mensagemContrato(def.nome, args);
    }
  }
  if (/insufficient funds|exceeds the balance/i.test(txt)) {
    return 'Saldo em ETH insuficiente para pagar o valor mais a taxa de gas. Pegue ETH de teste em um faucet da Sepolia.';
  }
  if (cod === -32002) return 'Já existe uma solicitação pendente na MetaMask. Abra a extensão e responda.';
  if (/revert/i.test(txt)) return 'O contrato recusou a operação (revert).';
  if (/network|fetch|timeout/i.test(txt)) return 'Falha de conexão com a rede. Tente novamente em instantes.';
  return 'Não foi possível concluir a operação. ' + (e?.message ? String(e.message).slice(0, 140) : '');
}

/* Leituras do contrato e eventos */
const _cacheProdutos = new Map();
async function produtoPorId(id) {
  const k = String(id);
  if (!_cacheProdutos.has(k)) _cacheProdutos.set(k, await lerC().methods.obterProduto(id).call());
  return _cacheProdutos.get(k);
}

async function listarTodosProdutos() {
  const c = lerC();
  const total = Number(await c.methods.totalProdutos().call());
  const max = Number(await c.methods.MAX_POR_PAGINA().call());
  const todos = [];
  for (let ini = 0; ini < total; ini += max) {
    todos.push(...(await c.methods.listarProdutos(ini, Math.min(max, total - ini)).call()));
  }
  return todos;
}

// papel: 'comprador' ou 'vendedor'
async function listarPedidos(papel, conta) {
  const c = lerC();
  const cont = await c.methods.contarPedidos(conta).call();
  const total = Number(papel === 'comprador' ? (cont.comoComprador ?? cont[0]) : (cont.comoVendedor ?? cont[1]));
  const max = Number(await c.methods.MAX_POR_PAGINA().call());
  const metodo = papel === 'comprador' ? 'listarPedidosDoComprador' : 'listarPedidosDoVendedor';
  const todos = [];
  for (let ini = 0; ini < total; ini += max) {
    todos.push(...(await c.methods[metodo](conta, ini, Math.min(max, total - ini)).call()));
  }
  return todos.sort((a, b) => Number(b.id) - Number(a.id));
}

async function eventos(nome, filtro = {}) {
  const opcoes = { filter: filtro, fromBlock: BLOCO_DEPLOY, toBlock: 'latest' };
  try {
    return await lerC().getPastEvents(nome, opcoes);
  } catch (err) {
    const alternativo = lerC() === App.contratoLeitura ? App.contrato : App.contratoLeitura;
    if (!alternativo) throw err;
    return alternativo.getPastEvents(nome, opcoes);
  }
}

const _cacheBlocos = new Map();
async function dataDoBloco(n) {
  const k = String(n);
  if (!_cacheBlocos.has(k)) {
    const b = await App.leitor.eth.getBlock(n);
    _cacheBlocos.set(k, Number(b.timestamp) * 1000);
  }
  return new Date(_cacheBlocos.get(k)).toLocaleString('pt-BR');
}

async function hashesDeCriacao(conta) {
  const evs = await eventos('PedidoCriado', { comprador: conta });
  const mapa = {};
  evs.forEach((e) => { mapa[String(e.returnValues.pedidoId)] = e.transactionHash; });
  return mapa;
}

/* Carteira e rede (MetaMask)*/
async function conectar() {
  if (!window.ethereum) {
    aviso('erro', 'MetaMask não encontrada. Instale a extensão e recarregue a página.');
    return;
  }
  try {
    const contas = await window.ethereum.request({ method: 'eth_requestAccounts' });
    localStorage.removeItem('desconectado');
    App.conta = contas[0] || null;
    await atualizarEstado();
  } catch (e) {
    aviso('erro', traduzirErro(e));
  }
}

async function desconectar() {
  localStorage.setItem('desconectado', '1');   // "Sair" é local: a MetaMask continua autorizada
  App.conta = null;
  await atualizarEstado();
}

async function trocarParaSepolia() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_CHAIN_ID }] });
  } catch (e) {
    const codigo = e?.code ?? e?.data?.originalError?.code;
    if (codigo === 4902) {   // rede ainda não cadastrada na MetaMask
      try {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA_PARAMS] });
      } catch (e2) { aviso('erro', traduzirErro(e2)); }
    } else {
      aviso('erro', traduzirErro(e));
    }
  }
}

async function atualizarEstado() {
  if (window.ethereum) {
    try {
      App.chainId = await window.ethereum.request({ method: 'eth_chainId' });
      App.naSepolia = String(App.chainId).toLowerCase() === SEPOLIA_CHAIN_ID;
    } catch (_) { /* mantém valores anteriores */ }
  }
  if (App.conta) {
    try {
      const fonte = App.naSepolia ? App.web3 : App.leitor;   // saldo sempre da Sepolia
      App.saldo = await fonte.eth.getBalance(App.conta);
    } catch (_) { App.saldo = null; }
  } else {
    App.saldo = null;
  }
  try { App.dono = await lerC().methods.dono().call(); } catch (_) { App.dono = null; }
  try { App.pausado = await lerC().methods.pausado().call(); } catch (_) { App.pausado = false; }
  App.ehDono = mesmoEndereco(App.conta, App.dono);

  atualizarBanner();
  document.dispatchEvent(new CustomEvent('app:estado'));
}

Object.assign(App, { conectar, desconectar, trocarParaSepolia, atualizarEstado });

/* Transações (.send)*/
async function enviarTx(rotulo, fabrica, valorWei = '0') {
  let hash = null;
  try {
    if (!App.conta) throw erroAmigavel('Conecte sua carteira antes de continuar.');
    if (!App.naSepolia) { atualizarBanner(); throw erroAmigavel('Troque para a rede Sepolia para continuar.'); }

    const metodo = fabrica();
    const opts = { from: App.conta, value: valorWei };
    painelTx(null, 'pendente', rotulo, 'Verificando a transação…');
    await metodo.call(opts);   // simula: se for reverter, o erro aparece aqui e é decodificável

    painelTx(null, 'pendente', rotulo, 'Aguardando sua confirmação na MetaMask…');
    const promessa = metodo.send(opts);
    promessa.on('transactionHash', (h) => {
      hash = h;
      painelTx(h, 'pendente', rotulo, 'Enviada. Aguardando confirmação na rede…');
    });
    const recibo = await promessa;
    if (Number(recibo.status) !== 1) throw erroAmigavel('A transação foi revertida pela rede.');

    painelTx(recibo.transactionHash || hash, 'confirmada', rotulo);
    await atualizarEstado();   // atualiza saldo e redesenha a tela
    return recibo;
  } catch (e) {
    console.error(e);
    painelTx(hash, 'falhou', rotulo, traduzirErro(e));
    return null;
  }
}

/* Página Loja (index.html)*/
let PRODUTOS = [];

function desenharProdutos() {
  const termo = ($('#busca')?.value || '').toLowerCase().trim();
  const lista = PRODUTOS.filter((p) => p.ativo && p.nome.toLowerCase().includes(termo));
  const box = $('#lista-produtos');
  if (!lista.length) {
    box.innerHTML = vazio(PRODUTOS.length ? 'Nenhum produto encontrado.' : 'Ainda não há produtos cadastrados.');
    return;
  }
  box.innerHTML = lista.map((p) => {
    const tem = Number(p.estoque) > 0;
    const img = imgSegura(p.imagemURL);
    return `<article class="cartao produto">
      ${img ? `<img src="${esc(img)}" alt="${esc(p.nome)}">` : '<div class="sem-imagem">📦</div>'}
      <h3>${esc(p.nome)}</h3>
      <p>Vendido por ${curto(p.vendedor)}</p>
      <p>${weiParaEth(p.preco)} ETH</p>
      <p class="${tem ? 'verde' : 'vermelho'}">${tem ? `Disponível (${p.estoque})` : 'Esgotado'}</p>
      <button class="botao" data-comprar="${p.id}" ${tem && !App.pausado ? '' : 'disabled'}>Comprar</button>
    </article>`;
  }).join('');
}

PAGINAS.loja = async function paginaLoja(id) {
  const box = $('#lista-produtos');
  if (!PRODUTOS.length) box.innerHTML = vazio('Carregando produtos…');
  try {
    PRODUTOS = await listarTodosProdutos();
  } catch (e) {
    console.error(e);
    box.innerHTML = vazio('Não foi possível ler os produtos do contrato. Verifique sua conexão.');
    return;
  }
  if (id !== renderId) return;
  desenharProdutos();

  $('#busca').oninput = desenharProdutos;
  box.onclick = async (ev) => {
    const btn = ev.target.closest('[data-comprar]');
    if (!btn) return;
    const p = PRODUTOS.find((x) => String(x.id) === btn.dataset.comprar);
    if (!p) return;
    btn.disabled = true;
    const r = await enviarTx(`Compra: ${p.nome}`, () => App.contrato.methods.comprar(p.id), String(p.preco));
    if (r) aviso('ok', 'Compra realizada! Acompanhe em Pedidos.');
    else btn.disabled = false;
  };
};

async function renderPagina() {
  const id = ++renderId;
  const fn = PAGINAS[document.body.dataset.pagina];
  if (!fn) return;
  try { await fn(id); } catch (e) { console.error(e); aviso('erro', traduzirErro(e)); }
}

async function iniciar() {
  criarContainers();
  document.addEventListener('app:estado', renderPagina);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-conectar]')) conectar(); });

  App.leitor = new Web3(RPC_SEPOLIA);
  App.contratoLeitura = new App.leitor.eth.Contract(CONTRATO_ABI, CONTRATO_ENDERECO);

  if (window.ethereum) {
    App.web3 = new Web3(window.ethereum);
    App.contrato = new App.web3.eth.Contract(CONTRATO_ABI, CONTRATO_ENDERECO);

    window.ethereum.on('accountsChanged', async (contas) => {
      App.conta = contas[0] || null;
      if (App.conta) localStorage.removeItem('desconectado');
      await atualizarEstado();
    });
    window.ethereum.on('chainChanged', async () => { await atualizarEstado(); });

    if (localStorage.getItem('desconectado') !== '1') {
      try {
        const contas = await window.ethereum.request({ method: 'eth_accounts' });
        App.conta = contas[0] || null;
      } catch (_) {}
    }
  }
  await atualizarEstado();
}

document.addEventListener('DOMContentLoaded', iniciar);