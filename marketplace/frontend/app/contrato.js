const CONTRATO_ENDERECO = "0x4455aa53d8e3bfaeDb0142122dDFf2a331e3FC08";
const BLOCO_DEPLOY = 12141837;
const SEPOLIA_CHAIN_ID = "0xaa36a7";
const CONTRATO_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ContratoPausado",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "enum CriptoMarket.StatusPedido",
        name: "atual",
        type: "uint8",
      },
      {
        internalType: "enum CriptoMarket.StatusPedido",
        name: "esperado",
        type: "uint8",
      },
    ],
    name: "EstadoInvalido",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
    ],
    name: "EstoqueInsuficiente",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "chamador",
        type: "address",
      },
    ],
    name: "NaoAutorizado",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
    ],
    name: "PedidoInexistente",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
    ],
    name: "ProdutoInexistente",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "disponivel",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "solicitado",
        type: "uint256",
      },
    ],
    name: "SaldoInsuficiente",
    type: "error",
  },
  {
    inputs: [],
    name: "TransferenciaFalhou",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "esperado",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "enviado",
        type: "uint256",
      },
    ],
    name: "ValorIncorreto",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "bool",
        name: "favorComprador",
        type: "bool",
      },
    ],
    name: "DisputaResolvida",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "comprador",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "valorVendedor",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "taxa",
        type: "uint256",
      },
    ],
    name: "EntregaConfirmada",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bool",
        name: "pausado",
        type: "bool",
      },
    ],
    name: "PausaAlterada",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "canceladoPor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "valorReembolsado",
        type: "uint256",
      },
    ],
    name: "PedidoCancelado",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "comprador",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "vendedor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "valor",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "referencia",
        type: "bytes32",
      },
    ],
    name: "PedidoCriado",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "vendedor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "codigoRastreio",
        type: "string",
      },
    ],
    name: "PedidoEnviado",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "preco",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "estoque",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "ativo",
        type: "bool",
      },
    ],
    name: "ProdutoAtualizado",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "vendedor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "nome",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "preco",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "estoque",
        type: "uint256",
      },
    ],
    name: "ProdutoCadastrado",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "conta",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "valor",
        type: "uint256",
      },
    ],
    name: "Saque",
    type: "event",
  },
  {
    inputs: [],
    name: "BPS_DENOMINADOR",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_POR_PAGINA",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_RASTREIO",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "TAXA_BPS",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "novoPreco",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "novoEstoque",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "ativo",
        type: "bool",
      },
    ],
    name: "atualizarProduto",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "nome",
        type: "string",
      },
      {
        internalType: "string",
        name: "imagemURL",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "preco",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "estoque",
        type: "uint256",
      },
    ],
    name: "cadastrarProduto",
    outputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "valor",
        type: "uint256",
      },
    ],
    name: "calcularTaxa",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
    ],
    name: "cancelarPedido",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
    ],
    name: "comprar",
    outputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "comprouProduto",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
    ],
    name: "confirmarEntrega",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "conta",
        type: "address",
      },
    ],
    name: "contarPedidos",
    outputs: [
      {
        internalType: "uint256",
        name: "comoComprador",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "comoVendedor",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bool",
        name: "valor",
        type: "bool",
      },
    ],
    name: "definirPausa",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "dono",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "comprador",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "inicio",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantidade",
        type: "uint256",
      },
    ],
    name: "listarPedidosDoComprador",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "produtoId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "comprador",
            type: "address",
          },
          {
            internalType: "address payable",
            name: "vendedor",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "valor",
            type: "uint256",
          },
          {
            internalType: "enum CriptoMarket.StatusPedido",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "string",
            name: "codigoRastreio",
            type: "string",
          },
          {
            internalType: "bytes32",
            name: "referencia",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "criadoEm",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "atualizadoEm",
            type: "uint256",
          },
        ],
        internalType: "struct CriptoMarket.Pedido[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "vendedor",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "inicio",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantidade",
        type: "uint256",
      },
    ],
    name: "listarPedidosDoVendedor",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "produtoId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "comprador",
            type: "address",
          },
          {
            internalType: "address payable",
            name: "vendedor",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "valor",
            type: "uint256",
          },
          {
            internalType: "enum CriptoMarket.StatusPedido",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "string",
            name: "codigoRastreio",
            type: "string",
          },
          {
            internalType: "bytes32",
            name: "referencia",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "criadoEm",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "atualizadoEm",
            type: "uint256",
          },
        ],
        internalType: "struct CriptoMarket.Pedido[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "inicio",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "quantidade",
        type: "uint256",
      },
    ],
    name: "listarProdutos",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address payable",
            name: "vendedor",
            type: "address",
          },
          {
            internalType: "string",
            name: "nome",
            type: "string",
          },
          {
            internalType: "string",
            name: "imagemURL",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "preco",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "estoque",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "ativo",
            type: "bool",
          },
        ],
        internalType: "struct CriptoMarket.Produto[]",
        name: "lista",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "codigoRastreio",
        type: "string",
      },
    ],
    name: "marcarEnviado",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
    ],
    name: "obterPedido",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "produtoId",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "comprador",
            type: "address",
          },
          {
            internalType: "address payable",
            name: "vendedor",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "valor",
            type: "uint256",
          },
          {
            internalType: "enum CriptoMarket.StatusPedido",
            name: "status",
            type: "uint8",
          },
          {
            internalType: "string",
            name: "codigoRastreio",
            type: "string",
          },
          {
            internalType: "bytes32",
            name: "referencia",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "criadoEm",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "atualizadoEm",
            type: "uint256",
          },
        ],
        internalType: "struct CriptoMarket.Pedido",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "produtoId",
        type: "uint256",
      },
    ],
    name: "obterProduto",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "address payable",
            name: "vendedor",
            type: "address",
          },
          {
            internalType: "string",
            name: "nome",
            type: "string",
          },
          {
            internalType: "string",
            name: "imagemURL",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "preco",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "estoque",
            type: "uint256",
          },
          {
            internalType: "bool",
            name: "ativo",
            type: "bool",
          },
        ],
        internalType: "struct CriptoMarket.Produto",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pausado",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "reputacao",
    outputs: [
      {
        internalType: "int256",
        name: "",
        type: "int256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "pedidoId",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "favorComprador",
        type: "bool",
      },
    ],
    name: "resolverDisputa",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "valor",
        type: "uint256",
      },
    ],
    name: "sacar",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "saldos",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalEmCustodia",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalPedidos",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalProdutos",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
