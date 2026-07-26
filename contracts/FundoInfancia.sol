// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  FundoInfancia — Raízes do Futuro (Boipeba, BA)
 * @notice Fundo comunitário de saúde e educação infantil, no padrão da Rede Recy.
 *
 *  Correspondência com o RecyReport.sol (Sepolia
 *  0xc2b9a91fd9789ebe93c22b5a4981c2d643c9e6b1):
 *    mintRecyReportResult  -> askForFunding   (família solicita assistência p/ saúde ou educação)
 *    validateRecyReport    -> validateAsk     (validador confere evidências: Certificados Recy + prova de necessidade)
 *    claimRecyReportReward -> claimFunding    (libera o recurso após validação)
 *
 *  Governança Raízes do Futuro embutida no validateAsk:
 *    a liberação exige APROVACOES_NECESSARIAS (2) validações de signatários distintos
 *    entre Instituto Vivá, DeTrash e Representante Comunitário — nenhuma organização
 *    aprova sozinha (equivalente on-chain do nosso cofre 2-de-3).
 *
 *  Princípios do projeto preservados:
 *    - a renda do trabalho de coleta é paga fora deste contrato e é INCONDICIONAL;
 *    - pedido validado sem saldo no fundo fica RESERVADO (nunca perdido): o
 *      claimFunding pode ser chamado depois, quando houver saldo;
 *    - nenhum dado pessoal de criança on-chain: apenas o hash da evidência
 *      (documentos ficam no ambiente seguro off-chain, conforme LGPD).
 *
 *  Compatível com o padrão de proxies da Rede Recy: sem constructor com estado;
 *  toda a configuração acontece em initialize(), chamada uma única vez pelo
 *  contrato principal ao criar o proxy do piloto.
 */
contract FundoInfancia {
    /* ------------------------------------------------------------ config --- */
    uint8 public constant APROVACOES_NECESSARIAS = 2; // 2-de-3

    bool private _inicializado;
    address public institutoViva;            // validação social
    address public deTrash;                  // auditoria ambiental / metodologia
    address public representanteComunitario; // controle social do território

    /* ------------------------------------------------------------ pedidos --- */
    enum Status { Inexistente, Solicitado, Validado, Liberado }

    struct Pedido {
        address familia;       // carteira que recebe
        uint96  valor;         // em wei
        string  categoria;     // "saude" | "educacao"
        string  evidenciaHash; // hash dos Certificados Recy + prova de necessidade (off-chain)
        Status  status;
        uint8   aprovacoes;
    }

    uint256 public totalPedidos;
    mapping(uint256 => Pedido) public pedidos;
    mapping(uint256 => mapping(address => bool)) public aprovadoPor; // pedido => validador => já aprovou?

    /* ------------------------------------------------------------ eventos --- */
    event FundoInicializado(address institutoViva, address deTrash, address representanteComunitario);
    event DepositoRecebido(address indexed de, uint256 valor);
    event FundingSolicitado(uint256 indexed id, address indexed familia, uint256 valor, string categoria, string evidenciaHash);
    event AskValidado(uint256 indexed id, address indexed validador, uint8 aprovacoes, bool atingiuLimiar);
    event FundingLiberado(uint256 indexed id, address indexed familia, uint256 valor);
    event FundingReservado(uint256 indexed id, uint256 valorNecessario, uint256 saldoDisponivel);

    /* --------------------------------------------------------- modificadores */
    modifier apenasValidador() {
        require(
            msg.sender == institutoViva || msg.sender == deTrash || msg.sender == representanteComunitario,
            "FundoInfancia: apenas signatarios credenciados"
        );
        _;
    }

    /* ---------------------------------------------------------- initialize --- */
    /// @notice Chamada uma única vez pelo contrato principal da Rede Recy ao criar o proxy do piloto.
    function initialize(
        address _institutoViva,
        address _deTrash,
        address _representanteComunitario
    ) external {
        require(!_inicializado, "FundoInfancia: ja inicializado");
        require(
            _institutoViva != address(0) && _deTrash != address(0) && _representanteComunitario != address(0),
            "FundoInfancia: signatario invalido"
        );
        require(
            _institutoViva != _deTrash && _deTrash != _representanteComunitario && _institutoViva != _representanteComunitario,
            "FundoInfancia: signatarios devem ser distintos"
        );
        _inicializado = true;
        institutoViva = _institutoViva;
        deTrash = _deTrash;
        representanteComunitario = _representanteComunitario;
        emit FundoInicializado(_institutoViva, _deTrash, _representanteComunitario);
    }

    /* ------------------------------------------------------------ depósitos */
    /// @notice Recebe os 25% da receita da economia circular (split feito na origem).
    receive() external payable {
        emit DepositoRecebido(msg.sender, msg.value);
    }

    /* ---------------------------------------------------------------- fluxo */

    /// @notice (1) A família solicita assistência para saúde ou educação de uma criança.
    /// @param valor          quantia solicitada, em wei
    /// @param categoria      "saude" ou "educacao"
    /// @param evidenciaHash  hash das evidências (Certificados Recy + prova de necessidade) guardadas off-chain
    function askForFunding(uint96 valor, string calldata categoria, string calldata evidenciaHash)
        external
        returns (uint256 id)
    {
        require(_inicializado, "FundoInfancia: nao inicializado");
        require(valor > 0, "FundoInfancia: valor deve ser positivo");
        require(bytes(evidenciaHash).length > 0, "FundoInfancia: evidencia obrigatoria");

        id = ++totalPedidos;
        Pedido storage p = pedidos[id];
        p.familia = msg.sender;
        p.valor = valor;
        p.categoria = categoria;
        p.evidenciaHash = evidenciaHash;
        p.status = Status.Solicitado;

        emit FundingSolicitado(id, msg.sender, valor, categoria, evidenciaHash);
    }

    /// @notice (2) Um signatário credenciado valida as evidências e parâmetros do pedido.
    ///         Ao atingir 2 validações de signatários distintos, o pedido fica liberável.
    function validateAsk(uint256 id) external apenasValidador {
        Pedido storage p = pedidos[id];
        require(p.status == Status.Solicitado, "FundoInfancia: pedido nao esta aguardando validacao");
        require(!aprovadoPor[id][msg.sender], "FundoInfancia: este signatario ja validou");

        aprovadoPor[id][msg.sender] = true;
        p.aprovacoes += 1;

        bool atingiu = p.aprovacoes >= APROVACOES_NECESSARIAS;
        if (atingiu) p.status = Status.Validado;

        emit AskValidado(id, msg.sender, p.aprovacoes, atingiu);
    }

    /// @notice (3) Libera o recurso para a família após a validação 2-de-3.
    ///         Sem saldo suficiente, o pedido permanece Validado (reservado, nunca perdido)
    ///         e pode ser sacado assim que novos depósitos entrarem.
    function claimFunding(uint256 id) external {
        Pedido storage p = pedidos[id];
        require(p.status == Status.Validado, "FundoInfancia: pedido nao validado");
        require(msg.sender == p.familia, "FundoInfancia: apenas a familia solicitante");

        if (address(this).balance < p.valor) {
            emit FundingReservado(id, p.valor, address(this).balance);
            revert("FundoInfancia: saldo insuficiente - pedido segue reservado");
        }

        p.status = Status.Liberado;
        (bool ok, ) = p.familia.call{ value: p.valor }("");
        require(ok, "FundoInfancia: falha na transferencia");

        emit FundingLiberado(id, p.familia, p.valor);
    }

    /* ------------------------------------------------------------ consultas */
    function saldoFundo() external view returns (uint256) {
        return address(this).balance;
    }

    function statusPedido(uint256 id) external view returns (Status) {
        return pedidos[id].status;
    }
}
