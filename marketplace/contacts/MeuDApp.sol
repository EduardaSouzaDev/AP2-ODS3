// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CriptoMarket — Marketplace com pagamento em custódia (escrow) na Ethereum
/// @notice Vendedores anunciam produtos; o comprador paga em ETH e o valor fica retido
///         no contrato até ele confirmar que recebeu o produto. Só então o vendedor recebe.
/// @dev Pagamentos usam o padrão "pull payment": valores são creditados em `saldos`
///      e cada conta saca com `sacar()`, seguindo checks-effects-interactions.
contract CriptoMarket {
    // =====================================================================
    // [Recurso: StructsEEnums]
    // =====================================================================

    /// @notice Estados possíveis de um pedido (máquina de estados do escrow).
    enum StatusPedido {
        Pago,       // 0 - comprador pagou, ETH retido em custódia
        Enviado,    // 1 - vendedor informou o código de rastreio
        Entregue,   // 2 - comprador confirmou, vendedor recebeu o crédito
        Cancelado   // 3 - pedido cancelado, comprador recebeu reembolso
    }

    /// @notice Produto anunciado no marketplace.
    struct Produto {
        uint256 id;
        address payable vendedor;
        string nome;
        string imagemURL;
        uint256 preco;  
        uint256 estoque;
        bool ativo;
    }

    /// @notice Pedido de compra de uma unidade de um produto.
    struct Pedido {
        uint256 id;
        uint256 produtoId;
        address comprador;
        address payable vendedor;
        uint256 valor;      
        StatusPedido status;
        string codigoRastreio;
        bytes32 referencia;  
        uint256 criadoEm;
        uint256 atualizadoEm;
    }

    // =====================================================================
    // [Recurso: TiposDeDados] constantes, immutable e variáveis de estado
    // =====================================================================

    /// @notice Taxa da plataforma em pontos-base (250 = 2,5%).
    uint256 public constant TAXA_BPS = 250;
    /// @notice Denominador dos pontos-base.
    uint256 public constant BPS_DENOMINADOR = 10_000;
    /// @notice Limite de itens por página nas listagens.
    uint256 public constant MAX_POR_PAGINA = 50;
    /// @notice Tamanho máximo do código de rastreio.
    uint256 public constant MAX_RASTREIO = 64;

    /// @notice Dono (administrador) da plataforma, definido no deploy e imutável.
    address public immutable dono;

    /// @notice Quando true, novas vendas e cadastros ficam bloqueados.
    bool public pausado;

    /// @notice Quantidade de pedidos já criados.
    uint256 public totalPedidos;

    /// @notice Total de ETH atualmente retido em custódia.
    uint256 public totalEmCustodia;

    // =====================================================================
    // [Recurso: ArraysEMappings]
    // =====================================================================

    /// @notice Array dinâmico com todos os produtos.
    Produto[] private produtos;

    /// @notice mapping -> struct: pedidos por id.
    mapping(uint256 => Pedido) private pedidos;

    /// @notice mapping simples: saldo disponível para saque de cada conta.
    mapping(address => uint256) public saldos;

    /// @notice Reputação do vendedor (+1 por entrega confirmada, -1 por perda em disputa).
    /// [Recurso: TiposDeDados] int256 porque a reputação pode ficar negativa.
    mapping(address => int256) public reputacao;

    /// @notice mapping -> array: ids dos pedidos de cada comprador.
    mapping(address => uint256[]) private pedidosDoComprador;

    /// @notice mapping -> array: ids dos pedidos recebidos por cada vendedor.
    mapping(address => uint256[]) private pedidosDoVendedor;

    /// @notice mapping aninhado: comprador => produtoId => já comprou e recebeu?
    mapping(address => mapping(uint256 => bool)) public comprouProduto;

    // =====================================================================
    // [Recurso: EventosEErros] eventos
    // =====================================================================

    event ProdutoCadastrado(uint256 indexed produtoId, address indexed vendedor, string nome, uint256 preco, uint256 estoque);
    event ProdutoAtualizado(uint256 indexed produtoId, uint256 preco, uint256 estoque, bool ativo);
    event PedidoCriado(uint256 indexed pedidoId, uint256 indexed produtoId, address indexed comprador, address vendedor, uint256 valor, bytes32 referencia);
    event PedidoEnviado(uint256 indexed pedidoId, address indexed vendedor, string codigoRastreio);
    event EntregaConfirmada(uint256 indexed pedidoId, address indexed comprador, uint256 valorVendedor, uint256 taxa);
    event PedidoCancelado(uint256 indexed pedidoId, address indexed canceladoPor, uint256 valorReembolsado);
    event DisputaResolvida(uint256 indexed pedidoId, bool indexed favorComprador);
    event Saque(address indexed conta, uint256 valor);
    event PausaAlterada(bool pausado);

    // =====================================================================
    // [Recurso: EventosEErros] erros personalizados
    // =====================================================================

    error NaoAutorizado(address chamador);
    error ProdutoInexistente(uint256 produtoId);
    error PedidoInexistente(uint256 pedidoId);
    error EstadoInvalido(StatusPedido atual, StatusPedido esperado);
    error ValorIncorreto(uint256 esperado, uint256 enviado);
    error EstoqueInsuficiente(uint256 produtoId);
    error SaldoInsuficiente(uint256 disponivel, uint256 solicitado);
    error ContratoPausado();
    error TransferenciaFalhou();

    // =====================================================================
    // [Recurso: Modificadores]
    // =====================================================================

    /// @dev Restringe a função ao dono da plataforma.
    modifier apenasDono() {
        if (msg.sender != dono) revert NaoAutorizado(msg.sender);
        _;
    }

    /// @dev Bloqueia a função enquanto o marketplace estiver pausado.
    modifier quandoAtivo() {
        if (pausado) revert ContratoPausado();
        _;
    }

    /// @dev Garante que o produto existe (modificador com parâmetro).
    modifier produtoExiste(uint256 produtoId) {
        if (produtoId >= produtos.length) revert ProdutoInexistente(produtoId);
        _;
    }

    /// @dev Garante que o pedido existe.
    modifier pedidoExiste(uint256 pedidoId) {
        if (pedidoId == 0 || pedidoId > totalPedidos) revert PedidoInexistente(pedidoId);
        _;
    }

    /// @dev Garante que o pedido está no estado esperado (modificador com parâmetros).
    modifier noEstado(uint256 pedidoId, StatusPedido esperado) {
        StatusPedido atual = pedidos[pedidoId].status;
        if (atual != esperado) revert EstadoInvalido(atual, esperado);
        _;
    }

    // =====================================================================
    // [Recurso: Funcoes] constructor
    // =====================================================================

    /// @notice Implanta o marketplace; quem faz o deploy vira o dono.
    constructor() {
        dono = msg.sender;
    }

    // =====================================================================
    // Funções de negócio — vendedor
    // =====================================================================

    /// @notice Anuncia um novo produto à venda.
    /// @param nome Nome do produto (não pode ser vazio).
    /// @param imagemURL URL da imagem exibida no frontend.
    /// @param preco Preço unitário em wei (maior que zero).
    /// @param estoque Quantidade disponível (maior que zero).
    /// @return produtoId Id do produto criado.
    function cadastrarProduto(
        string calldata nome,
        string calldata imagemURL,
        uint256 preco,
        uint256 estoque
    ) external quandoAtivo returns (uint256 produtoId) {
        // [Recurso: EstruturasDeControle] require
        require(bytes(nome).length > 0 && bytes(nome).length <= 80, "Nome invalido");
        require(preco > 0, "Preco deve ser maior que zero");
        require(estoque > 0, "Estoque deve ser maior que zero");

        produtoId = produtos.length;
        produtos.push(Produto({
            id: produtoId,
            vendedor: payable(msg.sender),
            nome: nome,
            imagemURL: imagemURL,
            preco: preco,
            estoque: estoque,
            ativo: true
        }));

        emit ProdutoCadastrado(produtoId, msg.sender, nome, preco, estoque);
    }

    /// @notice Atualiza preço, estoque ou disponibilidade de um produto próprio.
    /// @param produtoId Id do produto.
    /// @param novoPreco Novo preço em wei.
    /// @param novoEstoque Novo estoque.
    /// @param ativo true para exibir na loja, false para retirar.
    function atualizarProduto(uint256 produtoId, uint256 novoPreco, uint256 novoEstoque, bool ativo)
        external
        produtoExiste(produtoId)
    {
        Produto storage p = produtos[produtoId];
        if (msg.sender != p.vendedor) revert NaoAutorizado(msg.sender);
        require(novoPreco > 0, "Preco deve ser maior que zero");

        p.preco = novoPreco;
        p.estoque = novoEstoque;
        p.ativo = ativo;

        emit ProdutoAtualizado(produtoId, novoPreco, novoEstoque, ativo);
    }

    /// @notice Vendedor informa que despachou o pedido e registra o código de rastreio.
    /// @param pedidoId Id do pedido.
    /// @param codigoRastreio Código fornecido pela transportadora.
    function marcarEnviado(uint256 pedidoId, string calldata codigoRastreio)
        external
        pedidoExiste(pedidoId)
        noEstado(pedidoId, StatusPedido.Pago)
    {
        Pedido storage ped = pedidos[pedidoId];
        if (msg.sender != ped.vendedor) revert NaoAutorizado(msg.sender);
        uint256 tam = bytes(codigoRastreio).length;
        require(tam > 0 && tam <= MAX_RASTREIO, "Codigo de rastreio invalido");

        ped.codigoRastreio = codigoRastreio;
        _mudarStatus(ped, StatusPedido.Enviado);

        emit PedidoEnviado(pedidoId, msg.sender, codigoRastreio);
    }

    // =====================================================================
    // Funções de negócio — comprador
    // =====================================================================

    /// @notice Compra uma unidade do produto. O ETH enviado fica retido em custódia.
    /// @param produtoId Id do produto.
    /// @return pedidoId Id do pedido criado.
    function comprar(uint256 produtoId)
        external
        payable
        quandoAtivo
        produtoExiste(produtoId)
        returns (uint256 pedidoId)
    {
        Produto storage p = produtos[produtoId];

        // [Recurso: EstruturasDeControle] if/else com erros personalizados
        if (!p.ativo || p.estoque == 0) {
            revert EstoqueInsuficiente(produtoId);
        } else if (msg.value != p.preco) {
            revert ValorIncorreto(p.preco, msg.value);
        }
        require(msg.sender != p.vendedor, "Vendedor nao pode comprar o proprio produto");

        p.estoque -= 1;
        totalEmCustodia += msg.value;
        pedidoId = _registrarPedido(p, msg.sender, msg.value);
    }

    /// @notice Comprador confirma o recebimento, o valor (menos a taxa) é liberado ao vendedor.
    /// @param pedidoId Id do pedido.
    function confirmarEntrega(uint256 pedidoId)
        external
        pedidoExiste(pedidoId)
        noEstado(pedidoId, StatusPedido.Enviado)
    {
        Pedido storage ped = pedidos[pedidoId];
        if (msg.sender != ped.comprador) revert NaoAutorizado(msg.sender);

        _liberarAoVendedor(ped);
        comprouProduto[ped.comprador][ped.produtoId] = true;
    }

    /// @notice Cancela um pedido ainda não enviado e reembolsa o comprador.
    /// @dev Pode ser chamado pelo comprador ou pelo vendedor enquanto o status for Pago.
    /// @param pedidoId Id do pedido.
    function cancelarPedido(uint256 pedidoId)
        external
        pedidoExiste(pedidoId)
        noEstado(pedidoId, StatusPedido.Pago)
    {
        Pedido storage ped = pedidos[pedidoId];
        if (msg.sender != ped.comprador && msg.sender != ped.vendedor) {
            revert NaoAutorizado(msg.sender);
        }
        produtos[ped.produtoId].estoque += 1; // devolve a unidade ao estoque
        _reembolsar(ped);
    }

    // =====================================================================
    // Saque
    // =====================================================================

    /// @notice Saca ETH do seu saldo disponível no contrato.
    /// @param valor Quantia em wei a sacar.
    function sacar(uint256 valor) external {
        uint256 disponivel = saldos[msg.sender];
        // Checks
        if (valor == 0 || valor > disponivel) revert SaldoInsuficiente(disponivel, valor);
        // Effects
        saldos[msg.sender] = disponivel - valor;
        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        if (!ok) revert TransferenciaFalhou();

        emit Saque(msg.sender, valor);
    }

    // =====================================================================
    // Funções administrativas
    // =====================================================================

    /// @notice Resolve um pedido enviado em que o comprador não confirmou a entrega.
    /// @param pedidoId Id do pedido em disputa.
    /// @param favorComprador true reembolsa o comprador, false libera o valor ao vendedor.
    function resolverDisputa(uint256 pedidoId, bool favorComprador)
        external
        apenasDono
        pedidoExiste(pedidoId)
        noEstado(pedidoId, StatusPedido.Enviado)
    {
        Pedido storage ped = pedidos[pedidoId];
        if (favorComprador) {
            reputacao[ped.vendedor] -= 1;
            _reembolsar(ped);
        } else {
            _liberarAoVendedor(ped);
        }
        emit DisputaResolvida(pedidoId, favorComprador);
    }

    /// @notice Pausa ou retoma novas vendas e cadastros (pedidos em andamento continuam).
    /// @param valor true para pausar, false para retomar.
    function definirPausa(bool valor) external apenasDono {
        pausado = valor;
        emit PausaAlterada(valor);
    }

    // =====================================================================
    // Consultas
    // =====================================================================

    /// @notice Quantidade de produtos cadastrados.
    function totalProdutos() external view returns (uint256) {
        return produtos.length;
    }

    /// @notice Retorna um produto pelo id.
    function obterProduto(uint256 produtoId) external view produtoExiste(produtoId) returns (Produto memory) {
        return produtos[produtoId];
    }

    /// @notice Retorna um pedido pelo id.
    function obterPedido(uint256 pedidoId) external view pedidoExiste(pedidoId) returns (Pedido memory) {
        return pedidos[pedidoId];
    }

    /// @notice Lista produtos de forma paginada.
    /// @param inicio Índice inicial.
    /// @param quantidade Máximo de itens (limitado a MAX_POR_PAGINA).
    function listarProdutos(uint256 inicio, uint256 quantidade) external view returns (Produto[] memory lista) {
        uint256 fim = _fimPagina(inicio, quantidade, produtos.length);
        lista = new Produto[](fim - inicio);
        // [Recurso: EstruturasDeControle] laço com limite controlado
        for (uint256 i = inicio; i < fim; i++) {
            lista[i - inicio] = produtos[i];
        }
    }

    /// @notice Lista os pedidos de um comprador.
    function listarPedidosDoComprador(address comprador, uint256 inicio, uint256 quantidade)
        external
        view
        returns (Pedido[] memory)
    {
        return _listarPedidos(pedidosDoComprador[comprador], inicio, quantidade);
    }

    /// @notice Lista os pedidos recebidos por um vendedor.
    function listarPedidosDoVendedor(address vendedor, uint256 inicio, uint256 quantidade)
        external
        view
        returns (Pedido[] memory)
    {
        return _listarPedidos(pedidosDoVendedor[vendedor], inicio, quantidade);
    }

    /// @notice Quantos pedidos um comprador e um vendedor possuem.
    function contarPedidos(address conta) external view returns (uint256 comoComprador, uint256 comoVendedor) {
        return (pedidosDoComprador[conta].length, pedidosDoVendedor[conta].length);
    }

    /// @notice Calcula a taxa da plataforma sobre um valor.
    /// @param valor Valor em wei.
    /// @return Taxa em wei.
    function calcularTaxa(uint256 valor) public pure returns (uint256) {
        return (valor * TAXA_BPS) / BPS_DENOMINADOR;
    }

    // =====================================================================
    // Funções internas e privadas
    // =====================================================================

    /// @dev Cria o pedido, indexa por comprador/vendedor e emite o evento.
    function _registrarPedido(Produto storage p, address comprador, uint256 valor) internal returns (uint256 pedidoId) {
        pedidoId = ++totalPedidos;
        bytes32 ref = _gerarReferencia(pedidoId, comprador);

        pedidos[pedidoId] = Pedido({
            id: pedidoId,
            produtoId: p.id,
            comprador: comprador,
            vendedor: p.vendedor,
            valor: valor,
            status: StatusPedido.Pago,
            codigoRastreio: "",
            referencia: ref,
            criadoEm: block.timestamp,
            atualizadoEm: block.timestamp
        });
        pedidosDoComprador[comprador].push(pedidoId);
        pedidosDoVendedor[p.vendedor].push(pedidoId);

        emit PedidoCriado(pedidoId, p.id, comprador, p.vendedor, valor, ref);
    }

    /// @dev Tira o valor da custódia e credita vendedor (valor - taxa) e dono (taxa).
    function _liberarAoVendedor(Pedido storage ped) internal {
        uint256 taxa = calcularTaxa(ped.valor);
        uint256 liquido = ped.valor - taxa;

        _mudarStatus(ped, StatusPedido.Entregue);
        totalEmCustodia -= ped.valor;
        saldos[ped.vendedor] += liquido;
        saldos[dono] += taxa;
        reputacao[ped.vendedor] += 1;

        emit EntregaConfirmada(ped.id, ped.comprador, liquido, taxa);
    }

    /// @dev Tira o valor da custódia e credita o comprador integralmente.
    function _reembolsar(Pedido storage ped) internal {
        _mudarStatus(ped, StatusPedido.Cancelado);
        totalEmCustodia -= ped.valor;
        saldos[ped.comprador] += ped.valor;

        emit PedidoCancelado(ped.id, msg.sender, ped.valor);
    }

    /// @dev Atualiza status e data da última alteração.
    function _mudarStatus(Pedido storage ped, StatusPedido novo) private {
        ped.status = novo;
        ped.atualizadoEm = block.timestamp;
    }

    /// @dev Gera um identificador único para o pedido.
    function _gerarReferencia(uint256 pedidoId, address comprador) private view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), pedidoId, comprador, block.timestamp));
    }

    /// @dev Calcula o fim de uma página respeitando MAX_POR_PAGINA e o tamanho da lista.
    function _fimPagina(uint256 inicio, uint256 quantidade, uint256 total) private pure returns (uint256 fim) {
        if (inicio >= total) return inicio; // página vazia
        if (quantidade > MAX_POR_PAGINA) quantidade = MAX_POR_PAGINA;
        fim = inicio + quantidade;
        if (fim > total) fim = total;
    }

    /// @dev Monta uma página de pedidos a partir de uma lista de ids.
    function _listarPedidos(uint256[] storage ids, uint256 inicio, uint256 quantidade)
        private
        view
        returns (Pedido[] memory lista)
    {
        uint256 fim = _fimPagina(inicio, quantidade, ids.length);
        lista = new Pedido[](fim - inicio);
        // [Recurso: EstruturasDeControle] laço limitado por MAX_POR_PAGINA
        for (uint256 i = inicio; i < fim; i++) {
            lista[i - inicio] = pedidos[ids[i]];
        }
    }
}
