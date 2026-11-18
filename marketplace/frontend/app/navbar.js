function desenharNavbar() {
  const pagina = document.body.dataset.pagina;
  const App = window.App || {};

  let links;
  if (pagina === "vendedor") {
    links = [
      ["loja", "Loja", "index.html"],
      ["vendedor", "Vendedor", "vendedor.html"],
    ];
  } else if (pagina === "admin") {
    links = [
      ["loja", "Loja", "index.html"],
      ["admin", "Admin", "admin.html"],
    ];
  } else {
    links = [
      ["loja", "Loja", "index.html"],
      ["pedidos", "Pedidos", "pedidos.html"],
      ["rastreio", "Rastreio", "rastreio.html"],
    ];
  }

  const menu = links
    .map(
      ([id, texto, arquivo]) =>
        `<a href="${arquivo}" class="${id === pagina ? "ativo" : ""}">${texto}</a>`,
    )
    .join("");

  const icone = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>`;

  let ladoDireito;
  if (App.conta) {
    ladoDireito = `
      <div class="carteira-area">
        <button class="carteira-menu-botao" id="btn-carteira" aria-haspopup="true" aria-expanded="false">
          <span class="carteira"><strong>Carteira Sepolia</strong><br><span id="carteira-saldo"></span><br><span id="carteira-endereco"></span></span>
          ${icone}
        </button>
        <div class="menu-carteira" id="menu-carteira" hidden>
          <a href="vendedor.html">Entrar como vendedor</a>
          ${App.ehDono ? '<a href="admin.html">Entrar como admin</a>' : ""}
          <button id="btn-sair">Sair</button>
        </div>
      </div>`;
  } else {
    ladoDireito = `<button class="carteira-botao" id="btn-conectar">Conectar Carteira</button>`;
  }

  document.getElementById("navbar").innerHTML =
    `<nav>${menu}</nav><div class="logo"><img src="../assets/logo.jpeg" alt="Logo"></div>${ladoDireito}`;

  if (App.conta) {
    document.getElementById("carteira-saldo").textContent =
      App.saldo != null ? `${App.formatarEth(App.saldo)} ETH` : "— ETH";
    const endereco = document.getElementById("carteira-endereco");
    endereco.textContent = App.enderecoCurto(App.conta);
    endereco.title = App.conta;
  }

  const conectarBtn = document.getElementById("btn-conectar");
  if (conectarBtn)
    conectarBtn.addEventListener(
      "click",
      () => window.App && window.App.conectar(),
    );

  const carteiraBtn = document.getElementById("btn-carteira");
  if (carteiraBtn) {
    carteiraBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const m = document.getElementById("menu-carteira");
      m.hidden = !m.hidden;
      carteiraBtn.setAttribute("aria-expanded", String(!m.hidden));
    });
    document
      .getElementById("btn-sair")
      .addEventListener("click", () => window.App.desconectar());
  }
}

// Fecha o menu ao clicar fora (registrado uma única vez)
document.addEventListener("click", () => {
  const m = document.getElementById("menu-carteira");
  if (m) m.hidden = true;
  document.getElementById("btn-carteira")?.setAttribute("aria-expanded", "false");
});

document.addEventListener("app:estado", desenharNavbar);
desenharNavbar();
