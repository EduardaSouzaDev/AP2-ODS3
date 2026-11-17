// Testes da integração compartilhada, sem navegador, dependências ou RPC externo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const raiz = path.join(__dirname, '../frontend/app');
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const HASH = '0x' + 'ab'.repeat(32);

class Elemento extends EventTarget {
  constructor(tag) { super(); this.tagName = tag; this.children = []; this.className = ''; this._texto = ''; this.classList = { add: (nome) => { this.className += ` ${nome}`; } }; }
  set textContent(texto) { this._texto = String(texto); this.children = []; }
  get textContent() { return this._texto + this.children.map((filho) => filho.textContent).join(' '); }
  append(...filhos) { filhos.forEach((filho) => { filho.parent = this; this.children.push(filho); }); }
  prepend(filho) { filho.parent = this; this.children.unshift(filho); }
  after(filho) { this.parent?.append(filho); }
  replaceChildren(...filhos) { this._texto = ''; this.children = []; this.append(...filhos); }
  setAttribute(nome, valor) { this[nome] = valor; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((filho) => filho !== this); }
  querySelectorAll(seletor) { return this.children.flatMap((filho) => [...(filho.className.split(' ').includes(seletor.slice(1)) ? [filho] : []), ...filho.querySelectorAll(seletor)]); }
}

async function iniciar(opcoes = {}) {
  const estado = { chain: '0xaa36a7', contas: [A], saldo: 10n ** 20n, ...opcoes };
  const requisicoes = [];
  const envios = [];
  const leituras = [];
  const logs = [];
  const provider = new EventEmitter();
  provider.isMetaMask = true;
  provider.request = async (pedido) => {
    requisicoes.push(pedido);
    if (pedido.method === 'eth_chainId') return estado.chain;
    if (pedido.method === 'eth_accounts') return estado.contas;
    if (pedido.method === 'eth_requestAccounts') { if (estado.rejeitar) throw { code: 4001 }; return estado.contas; }
    if (pedido.method === 'wallet_switchEthereumChain') { estado.chain = pedido.params[0].chainId; return null; }
    throw Error(`RPC inesperado: ${pedido.method}`);
  };
  class Contrato {
    constructor() {
      this.methods = new Proxy({}, { get: (_, nome) => (...args) => ({
        call: async (tx) => {
          leituras.push({ nome, args, tx });
          if (estado.call) { const retorno = await estado.call(nome, args, tx); if (retorno !== undefined) return retorno; }
          if (nome === 'dono') return A;
          if (nome === 'pausado') return false;
          if (nome === 'totalProdutos') return 101n;
          if (nome === 'listarProdutos') return Array.from({ length: Math.min(50, 101 - Number(args[0])) }, (_, i) => ({ id: BigInt(args[0]) + BigInt(i) }));
          return 1n;
        },
        estimateGas: async () => { await estado.estimate?.(); return 100000n; },
        send: (tx) => {
          envios.push({ nome, args, tx });
          const listeners = {};
          const promessa = Promise.resolve().then(() => {
            listeners.transactionHash?.(HASH);
            if (estado.timeout) throw Error('Transaction polling timeout');
            return { transactionHash: HASH, status: estado.receiptStatus ?? 1n, blockNumber: 12141840n };
          });
          promessa.on = (nome, fn) => { listeners[nome] = fn; return promessa; };
          return promessa;
        },
      }) });
    }
    async getPastEvents(nome, filtro) {
      logs.push({ nome, filtro });
      return estado.logs ? estado.logs(nome, filtro) : [];
    }
  }
  class Web3 {
    constructor() {
      this.eth = { Contract: Contrato, getCode: async () => estado.semCodigo ? '0x' : '0x6000', getBalance: async () => estado.saldo, getGasPrice: async () => 1000000000n,
        getBlockNumber: async () => 12147000n,
        abi: { encodeFunctionSignature: (nome) => nome === 'ContratoPausado()' ? '0x89ee6c45' : '0x00000000', decodeParameters: () => ({}) } };
    }
  }
  const documento = new EventTarget();
  documento.body = new Elemento('body');
  const main = new Elemento('main');
  documento.body.append(main);
  documento.querySelector = () => main;
  documento.createElement = (nome) => new Elemento(nome);
  const janela = new EventTarget();
  if (!estado.semProvider) janela.ethereum = provider;
  const armazenamento = new Map();
  const contexto = vm.createContext({ window: janela, document: documento, Web3: estado.semWeb3 ? undefined : Web3,
    Event, CustomEvent: class extends Event {},
    sessionStorage: { getItem: (chave) => armazenamento.get(chave), setItem: (chave, valor) => armazenamento.set(chave, valor), removeItem: (chave) => armazenamento.delete(chave) },
    setTimeout: (fn) => queueMicrotask(fn),
  });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'contrato.js'), 'utf8'), contexto);
  vm.runInContext(fs.readFileSync(path.join(raiz, 'app.js'), 'utf8'), contexto);
  const aguardar = async () => { for (let i = 0; i < 10; i++) await new Promise(setImmediate); };
  await aguardar();
  return { App: janela.App, provider, estado, envios, requisicoes, leituras, logs, documento, aguardar };
}

test('restaura conta sem solicitar assinatura e mantém precisão de 1 wei', async () => {
  const { App, requisicoes } = await iniciar();
  assert.equal(App.pronto, true);
  assert.equal(App.ehDono, true);
  assert.equal(requisicoes.some((r) => r.method === 'eth_requestAccounts'), false);
  assert.equal(App.formatarEth('1000000000000000001'), '1.000000000000000001');
  assert.equal(App.formatarEth(1n), '0.000000000000000001');
});

test('ausência de MetaMask, CDN ou contrato produz estado indisponível', async () => {
  for (const opcoes of [{ semProvider: true }, { semWeb3: true }, { semCodigo: true }]) {
    const { App, envios } = await iniciar(opcoes);
    assert.equal(App.pronto, false);
    assert.equal(envios.length, 0);
    if (!opcoes.semProvider) assert.ok(App.falha);
  }
});

test('rede errada bloqueia transação; troca solicita exclusivamente Sepolia', async () => {
  const { App, envios, requisicoes } = await iniciar({ chain: '0x1' });
  await assert.rejects(App.enviar('comprar', ['0'], { value: '1' }));
  assert.equal(envios.length, 0);
  await App.trocarRede();
  assert.equal(requisicoes.find((r) => r.method === 'wallet_switchEthereumChain').params[0].chainId, '0xaa36a7');
  assert.equal(App.pronto, true);
});

test('rejeição e erro personalizado encapsulado são traduzidos', async () => {
  const { App, documento } = await iniciar({ rejeitar: true });
  await App.conectar();
  assert.match(documento.body.textContent, /rejeitada/);
  assert.match(App.erro({ cause: { data: '0x89ee6c45' } }), /pausado/);
  assert.equal(App.erro(App.validacao('Informe o preço.')), 'Informe o preço.');
});

test('saldo insuficiente impede envio; compra preserva wei exato e chainId', async () => {
  const { App, estado, envios, documento } = await iniciar({ saldo: 1n });
  await assert.rejects(App.enviar('comprar', ['0'], { value: '1000000000000001' }));
  assert.equal(envios.length, 0);
  estado.saldo = 10n ** 20n;
  await App.enviar('comprar', ['0'], { value: '1000000000000001' });
  assert.equal(envios[0].tx.value, '1000000000000001');
  assert.equal(envios[0].tx.chainId, '0xaa36a7');
  assert.match(documento.body.textContent, /confirmada/);
  assert.match(documento.body.textContent, new RegExp(HASH));
});

test('receipt revertido falha; perda de confirmação após hash permanece pendente', async () => {
  const falhou = await iniciar({ receiptStatus: 0n });
  await assert.rejects(falhou.App.enviar('comprar', ['0'], { value: '1' }));
  assert.match(falhou.documento.body.textContent, /falhou/);
  const pendente = await iniciar({ timeout: true });
  await assert.rejects(pendente.App.enviar('comprar', ['0'], { value: '1' }));
  assert.match(pendente.documento.body.textContent, /pendente/);
  assert.doesNotMatch(pendente.documento.body.textContent, /falhou/);
});

test('mudança de conta durante estimativa impede assinatura e remove administração', async () => {
  const t = await iniciar();
  t.estado.estimate = async () => { t.estado.contas = [B]; t.provider.emit('accountsChanged', [B]); };
  await assert.rejects(t.App.enviar('comprar', ['0'], { value: '1' }));
  await t.aguardar();
  assert.equal(t.envios.length, 0);
  assert.equal(t.App.conta, B);
  assert.equal(t.App.ehDono, false);
  t.estado.chain = '0x1';
  t.provider.emit('chainChanged', '0x1');
  assert.equal(t.App.pronto, false);
  await t.aguardar();
  assert.equal(t.App.redeCorreta, false);
});

test('consulta todos os produtos em lotes de até 50', async () => {
  const { App, leituras } = await iniciar();
  const produtos = await App.listarProdutos();
  assert.equal(produtos.length, 101);
  assert.equal(produtos[100].id, 100n);
  assert.deepEqual(leituras.filter((r) => r.nome === 'listarProdutos').map((r) => String(r.args[0])), ['0', '50', '100']);
});

test('histórico respeita janela, adapta limite RPC e propaga indisponibilidade', async () => {
  const t = await iniciar();
  t.estado.logs = async (_, filtro) => {
    if (BigInt(filtro.toBlock) - BigInt(filtro.fromBlock) >= 100n) throw Error('block range limit exceeded');
    return [];
  };
  await t.App.buscarEventos();
  assert.equal(BigInt(t.App.eventosAte) - BigInt(t.App.eventosDe), 4999n);
  assert.equal(t.logs.length > 10, true);
  t.estado.logs = async () => { throw Error('RPC offline'); };
  await assert.rejects(t.App.buscarEventos(), /RPC offline/);
});
