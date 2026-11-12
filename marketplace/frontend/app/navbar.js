function desenharNavbar() {
  const paginaAtual = document.body.dataset.pagina;

  // Carteira conectada (ou null se ainda não conectou)
//   const carteira = lerStorage('carteira', null);

const carteira = null; // Simulação de carteira conectada

  const links = [
    ['loja', 'Loja', 'index.html'],
    ['pedidos', 'Pedidos', 'pedidos.html'],
    ['rastreio', 'Rastreio', 'rastreio.html']
  ];

  const menu = links.map(([id, texto, arquivo]) =>
    `<a href="${arquivo}" class="${id === paginaAtual ? 'ativo' : ''}">${texto}</a>`
  ).join('');

  const ladoDireito = carteira
    ? `<div class="carteira">
         <strongentendi>Carteira Ethereum</strongentendi><br>
         ${carteira.saldo.toFixed(3)} ETH<br>
         ${carteira.endereco}
       </div>`
    : `<button class="carteira-botao" id="btn-conectar">Conectar Carteira</button>`;

  // Coloca tudo dentro do <header id="navbar">
  document.getElementById('navbar').innerHTML =
    `<nav>${menu}</nav><div class="logo">logo</div>${ladoDireito}`;

  // Se o botão existe, liga o clique a ele
  const botao = document.getElementById('btn-conectar');
  if (botao) botao.addEventListener('click', conectarCarteira);
}

// Conexão SIMULADA: salva uma carteira de teste com 0.845 ETH
// function conectarCarteira() {
//   salvarStorage('carteira', { endereco: '0x71C...9A32', saldo: 0.845 });
//   location.reload();  // recarrega a página para mostrar a carteira
// }

desenharNavbar();