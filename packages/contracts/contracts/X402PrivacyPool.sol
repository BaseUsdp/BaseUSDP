// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title X402PrivacyPool
 * @notice Privacy-preserving payment pool for x402 transactions on Base
 * @dev Equivalent to the Solana void402 program
 *
 * Features:
 * - Deposit USDC into privacy pool
 * - Withdraw with 1% fee
 * - Upload ZK proofs for private transfers
 * - Internal transfers (user to user, via relayer)
 * - External transfers (pool to any address, via relayer)
 */
contract X402PrivacyPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct UserBalance {
        uint256 available;
        uint256 deposited;
        uint256 withdrawn;
        bool initialized;
    }

    struct Pool {
        uint256 totalDeposited;
        bool initialized;
    }

    struct Proof {
        address sender;
        uint256 nonce;
        uint256 amount;
        address token;
        bool used;
        bool initialized;
        bytes proofBytes;
        bytes commitmentBytes;
        bytes blindingFactorBytes;
    }

    // ============ State Variables ============

    // user => token => UserBalance
    mapping(address => mapping(address => UserBalance)) public userBalances;

    // token => Pool
    mapping(address => Pool) public pools;

    // proofId (keccak256(nonce)) => Proof
    mapping(bytes32 => Proof) public proofs;

    // Authorized relayers
    mapping(address => bool) public authorizedRelayers;

    // Fee settings (in basis points, 100 = 1%)
    uint256 public withdrawFee = 100; // 1%
    uint256 public poolMaintenanceFee = 50; // 0.5%

    // Fee recipient
    address public feeRecipient;

    // Supported tokens
    mapping(address => bool) public supportedTokens;

    // ============ Events ============

    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 fee);
    event ProofUploaded(bytes32 indexed proofId, address indexed sender, uint256 amount);
    event InternalTransfer(bytes32 indexed proofId, address indexed recipient, uint256 amount);
    event ExternalTransfer(bytes32 indexed proofId, address indexed recipient, uint256 amount);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    // ============ Errors ============

    error InsufficientBalance();
    error ProofAlreadyUsed();
    error InvalidProof();
    error InvalidRelayerFee();
    error UnauthorizedRelayer();
    error UnsupportedToken();
    error ZeroAmount();
    error InvalidRecipient();

    // ============ Constructor ============

    constructor(address _feeRecipient) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        authorizedRelayers[msg.sender] = true;
    }

    // ============ Modifiers ============

    modifier onlyRelayer() {
        if (!authorizedRelayers[msg.sender]) revert UnauthorizedRelayer();
        _;
    }

    modifier onlySupportedToken(address token) {
        if (!supportedTokens[token]) revert UnsupportedToken();
        _;
    }

    // ============ Admin Functions ============

    function addRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function setWithdrawFee(uint256 _fee) external onlyOwner {
        require(_fee <= 500, "Fee too high"); // Max 5%
        withdrawFee = _fee;
    }

    function setPoolMaintenanceFee(uint256 _fee) external onlyOwner {
        require(_fee <= 200, "Fee too high"); // Max 2%
        poolMaintenanceFee = _fee;
    }

    // ============ Core Functions ============

    /**
     * @notice Deposit tokens into the privacy pool
     * @param token The ERC20 token to deposit
     * @param amount The amount to deposit
     */
    function deposit(
        address token,
        uint256 amount
    ) external nonReentrant onlySupportedToken(token) {
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        UserBalance storage userBalance = userBalances[msg.sender][token];
        userBalance.available += amount;
        userBalance.deposited += amount;
        userBalance.initialized = true;

        Pool storage pool = pools[token];
        pool.totalDeposited += amount;
        pool.initialized = true;

        emit Deposit(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw tokens from the privacy pool (1% fee)
     * @param token The ERC20 token to withdraw
     * @param amount The amount to withdraw (before fee)
     */
    function withdraw(
        address token,
        uint256 amount
    ) external nonReentrant onlySupportedToken(token) {
        if (amount == 0) revert ZeroAmount();

        UserBalance storage userBalance = userBalances[msg.sender][token];
        if (userBalance.available < amount) revert InsufficientBalance();

        uint256 fee = (amount * withdrawFee) / 10000;
        uint256 withdrawAmount = amount - fee;

        userBalance.available -= amount;
        userBalance.withdrawn += amount;

        Pool storage pool = pools[token];
        pool.totalDeposited -= amount;

        IERC20(token).safeTransfer(msg.sender, withdrawAmount);

        if (fee > 0) {
            IERC20(token).safeTransfer(feeRecipient, fee);
        }

        emit Withdraw(msg.sender, token, withdrawAmount, fee);
    }

    /**
     * @notice Upload a zero-knowledge proof for a future transfer
     * @param nonce Unique nonce for this proof
     * @param amount The amount being proven
     * @param token The token for this proof
     * @param proofBytes The ZK proof data
     * @param commitmentBytes The commitment data
     * @param blindingFactorBytes The blinding factor
     */
    function uploadProof(
        uint256 nonce,
        uint256 amount,
        address token,
        bytes calldata proofBytes,
        bytes calldata commitmentBytes,
        bytes calldata blindingFactorBytes
    ) external nonReentrant onlySupportedToken(token) {
        if (amount == 0) revert ZeroAmount();

        UserBalance storage userBalance = userBalances[msg.sender][token];
        if (userBalance.available < amount) revert InsufficientBalance();

        bytes32 proofId = keccak256(abi.encodePacked(nonce));

        if (proofs[proofId].initialized) revert ProofAlreadyUsed();

        proofs[proofId] = Proof({
            sender: msg.sender,
            nonce: nonce,
            amount: amount,
            token: token,
            used: false,
            initialized: true,
            proofBytes: proofBytes,
            commitmentBytes: commitmentBytes,
            blindingFactorBytes: blindingFactorBytes
        });

        emit ProofUploaded(proofId, msg.sender, amount);
    }

    /**
     * @notice Initialize a recipient's balance (called by relayer before internal transfer)
     * @param recipient The recipient address
     * @param token The token to initialize for
     */
    function initRecipientBalance(
        address recipient,
        address token
    ) external onlyRelayer onlySupportedToken(token) {
        if (recipient == address(0)) revert InvalidRecipient();

        UserBalance storage recipientBalance = userBalances[recipient][token];
        if (!recipientBalance.initialized) {
            recipientBalance.initialized = true;
        }
    }

    /**
     * @notice Execute an internal transfer using a proof (relayer only)
     * @param proofId The ID of the proof to use
     * @param recipient The recipient address
     * @param relayerFee The fee for the relayer
     */
    function internalTransfer(
        bytes32 proofId,
        address recipient,
        uint256 relayerFee
    ) external nonReentrant onlyRelayer {
        if (recipient == address(0)) revert InvalidRecipient();

        Proof storage proof = proofs[proofId];

        if (!proof.initialized) revert InvalidProof();
        if (proof.used) revert ProofAlreadyUsed();
        if (proof.amount == 0) revert InvalidProof();
        if (relayerFee > proof.amount) revert InvalidRelayerFee();

        address token = proof.token;
        UserBalance storage senderBalance = userBalances[proof.sender][token];
        UserBalance storage recipientBalance = userBalances[recipient][token];

        if (senderBalance.available < proof.amount) revert InsufficientBalance();

        uint256 transferAmount = proof.amount - relayerFee;

        senderBalance.available -= proof.amount;
        recipientBalance.available += transferAmount;
        recipientBalance.initialized = true;

        proof.used = true;

        emit InternalTransfer(proofId, recipient, transferAmount);
    }

    /**
     * @notice Execute an external transfer using a proof (relayer only)
     * @param proofId The ID of the proof to use
     * @param recipient The external recipient address
     * @param relayerFee The fee for the relayer
     */
    function externalTransfer(
        bytes32 proofId,
        address recipient,
        uint256 relayerFee
    ) external nonReentrant onlyRelayer {
        if (recipient == address(0)) revert InvalidRecipient();

        Proof storage proof = proofs[proofId];

        if (!proof.initialized) revert InvalidProof();
        if (proof.used) revert ProofAlreadyUsed();
        if (proof.amount == 0) revert InvalidProof();

        address token = proof.token;
        UserBalance storage senderBalance = userBalances[proof.sender][token];
        Pool storage pool = pools[token];

        if (senderBalance.available < proof.amount) revert InsufficientBalance();

        uint256 poolFee = (proof.amount * poolMaintenanceFee) / 10000;
        uint256 minPoolFee = 500; // Minimum fee in smallest units
        if (poolFee < minPoolFee) poolFee = minPoolFee;

        uint256 totalFees = relayerFee + poolFee;
        if (totalFees > proof.amount) revert InvalidRelayerFee();
        uint256 transferAmount = proof.amount - totalFees;

        senderBalance.available -= proof.amount;
        pool.totalDeposited -= transferAmount;

        IERC20(token).safeTransfer(recipient, transferAmount);

        if (poolFee > 0) {
            IERC20(token).safeTransfer(feeRecipient, poolFee);
        }

        proof.used = true;

        emit ExternalTransfer(proofId, recipient, transferAmount);
    }

    // ============ View Functions ============

    function getUserBalance(
        address user,
        address token
    ) external view returns (uint256 available, uint256 deposited, uint256 withdrawn) {
        UserBalance storage balance = userBalances[user][token];
        return (balance.available, balance.deposited, balance.withdrawn);
    }

    function getPoolInfo(
        address token
    ) external view returns (uint256 totalDeposited, bool initialized) {
        Pool storage pool = pools[token];
        return (pool.totalDeposited, pool.initialized);
    }

    function getProofInfo(
        bytes32 proofId
    ) external view returns (
        address sender,
        uint256 amount,
        address token,
        bool used,
        bool initialized
    ) {
        Proof storage proof = proofs[proofId];
        return (proof.sender, proof.amount, proof.token, proof.used, proof.initialized);
    }

    function isRelayer(address account) external view returns (bool) {
        return authorizedRelayers[account];
    }

    function getProofId(uint256 nonce) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(nonce));
    }
}
