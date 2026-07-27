// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ⚠️ NÃO IMPLANTADO — E NÃO SERÁ, NESTE PILOTO.
 *
 * Este contrato foi escrito para a Rede Recy (EVM). O projeto decidiu depois
 * ficar SÓ na Solana devnet, onde o cofre 2-de-3 existe de fato (multisig nativo
 * do SPL Token) e as liberações são executadas de verdade — ver
 * `onchain/liberar-bonus.mjs` e o painel "Liberações no cofre real".
 *
 * Ele fica no repositório como registro de desenho revisado e auditado (três
 * achados corrigidos: FundingReservado que nunca ocorria, gás cobrado da
 * família, initialize sem controle), não como código em produção. A REGRA 4
 * (saldo residual → ações coletivas) foi implementada no fluxo Solana e não
 * aqui, de propósito: um contrato que distribuísse o residual sozinho tomaria a
 * decisão no lugar da assembleia comunitária. O que precisa ser imutável é o
 * REGISTRO da decisão, e é isso que `onchain/ancorar-decisao.mjs` faz.
 *
 * Se algum dia este contrato for para uma rede, releia esta nota primeiro.
 *
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

    /**
     * Quem implantou, usado só para fechar a janela de front-running do
     * initialize (ver a função).
     *
     * É variável de STORAGE, não `immutable`, e isso é essencial: valor
     * `immutable` mora no bytecode e seria lido igual dentro de um proxy,
     * travando a Recy para fora. Em storage, o construtor grava no storage da
     * própria implantação — então num proxy este slot fica em zero e o contrato
     * principal da Recy segue livre para chamar initialize. Nenhuma
     * CONFIGURAÇÃO vive no construtor: o padrão de proxy continua respeitado.
     */
    address private _implantador;

    constructor() {
        _implantador = msg.sender;
    }
    address public institutoViva;            // validação social
    address public deTrash;                  // auditoria ambiental / metodologia
    address public representanteComunitario; // controle social do território

    /* ------------------------------------------------------------ pedidos --- */
    enum Status { Inexistente, Solicitado, Validado, Liberado }

    /// Categoria como enum, não string: impede "saúde"/"saude"/"Saude" virando
    /// registros distintos, e custa 1 byte em vez de um slot inteiro.
    enum Categoria { Saude, Educacao }

    struct Pedido {
        address   familia;       // carteira que recebe            (20 bytes)
        uint96    valor;         // em wei                         (12 bytes) → 1 slot com familia
        bytes32   evidenciaHash; // SHA-256 das evidências, off-chain
        Categoria categoria;
        Status    status;
        uint8     aprovacoes;
    }

    uint256 public totalPedidos;
    mapping(uint256 => Pedido) public pedidos;
    mapping(uint256 => mapping(address => bool)) public aprovadoPor; // pedido => validador => já aprovou?

    /* ------------------------------------------------------------ eventos --- */
    event FundoInicializado(address institutoViva, address deTrash, address representanteComunitario);
    event DepositoRecebido(address indexed de, uint256 valor);
    event FundingSolicitado(uint256 indexed id, address indexed familia, uint256 valor, Categoria categoria, bytes32 evidenciaHash);
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
        // Sem esta linha, qualquer pessoa poderia inicializar primeiro com 3
        // endereços próprios e assumir o fundo — a implantação e o initialize
        // acontecem em transações separadas, e essa janela é pública.
        // Em proxy, _implantador é zero e a condição libera a Recy.
        require(
            _implantador == address(0) || msg.sender == _implantador,
            "FundoInfancia: apenas quem implantou pode inicializar"
        );
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

    /// @notice (1) Registra o pedido de assistência de uma família para saúde ou educação.
    ///
    /// Quem chama é um signatário credenciado, não a família — de propósito. A
    /// família de Boipeba usa uma conta custodiada e **não tem ETH para gás**;
    /// obrigá-la a pagar taxa de rede contradiria o princípio de inclusão do
    /// projeto. O agente registra em nome dela e a família só recebe.
    /// Isso também evita que qualquer endereço infle o storage do contrato.
    ///
    /// @param familia        carteira que vai receber o recurso
    /// @param valor          quantia solicitada, em wei
    /// @param categoria      Saude ou Educacao
    /// @param evidenciaHash  SHA-256 das evidências (Certificados Recy + prova de necessidade), off-chain
    function askForFunding(
        address familia,
        uint96 valor,
        Categoria categoria,
        bytes32 evidenciaHash
    )
        external
        apenasValidador
        returns (uint256 id)
    {
        require(_inicializado, "FundoInfancia: nao inicializado");
        require(familia != address(0), "FundoInfancia: familia invalida");
        require(valor > 0, "FundoInfancia: valor deve ser positivo");
        require(evidenciaHash != bytes32(0), "FundoInfancia: evidencia obrigatoria");

        id = ++totalPedidos;
        Pedido storage p = pedidos[id];
        p.familia = familia;
        p.valor = valor;
        p.categoria = categoria;
        p.evidenciaHash = evidenciaHash;
        p.status = Status.Solicitado;

        emit FundingSolicitado(id, familia, valor, categoria, evidenciaHash);
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
    ///
    /// Chamável por QUALQUER endereço: o valor vai sempre para `p.familia`, então
    /// não há o que um terceiro ganhe além de pagar o gás no lugar dela — que é
    /// exatamente o que queremos (a operação paga, a família recebe).
    ///
    /// Sem saldo suficiente NÃO reverte: emite FundingReservado e mantém o
    /// pedido em Validado. Se revertesse, o log seria descartado junto com a
    /// transação e a regra "reservado, nunca perdido" não deixaria nenhuma
    /// evidência on-chain — além de queimar gás num pedido que só falha.
    /// @return liberado true se o dinheiro saiu; false se ficou reservado
    function claimFunding(uint256 id) external returns (bool liberado) {
        Pedido storage p = pedidos[id];
        require(p.status == Status.Validado, "FundoInfancia: pedido nao validado");

        if (address(this).balance < p.valor) {
            emit FundingReservado(id, p.valor, address(this).balance);
            return false;
        }

        p.status = Status.Liberado;
        (bool ok, ) = p.familia.call{ value: p.valor }("");
        require(ok, "FundoInfancia: falha na transferencia");

        emit FundingLiberado(id, p.familia, p.valor);
        return true;
    }

    /* ------------------------------------------------------------ consultas */
    function saldoFundo() external view returns (uint256) {
        return address(this).balance;
    }

    function statusPedido(uint256 id) external view returns (Status) {
        return pedidos[id].status;
    }
}
