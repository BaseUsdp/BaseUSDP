// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/IX402PrivacyPool.sol";

/**
 * @title SMSEscrow
 * @notice Holds USDC for an SMS-addressed payment until the recipient claims it
 *         (with a wallet signature) or the sender reclaims it after expiry.
 * @dev
 *   This is an adapter on top of X402PrivacyPool — settlement to the recipient
 *   goes through the pool's externalTransfer path so the on-chain link between
 *   the sender's deposit and the recipient's payout flows through the pool's
 *   anonymity set instead of being a direct transfer.
 *
 *   The pool is NOT modified by this contract. The only pool-side change
 *   required at deploy time is `pool.addRelayer(smsEscrow)` so SMSEscrow can
 *   call `pool.externalTransfer`. This is additive — existing relayers and
 *   deposit/payment flows are unaffected.
 *
 *   Escrows are keyed by a 32-byte `claimToken` generated client-side by the
 *   sender. The token is delivered to the recipient over SMS. The phone
 *   number never appears on-chain.
 */
contract SMSEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes;

    // ============ Constants ============

    uint64 public constant EXPIRY_SECONDS = 24 hours;

    // ============ Immutables ============

    IERC20 public immutable USDC;
    IX402PrivacyPool public immutable POOL;

    // ============ Types ============

    enum Status {
        None,
        Pending,
        Claimed,
        Refunded
    }

    struct Escrow {
        address sender;
        uint96 amount;
        uint64 expiresAt;
        Status status;
        address recipient;
    }

    // ============ State ============

    /// @notice claimToken => escrow record
    mapping(bytes32 => Escrow) public escrows;

    // ============ Events ============

    event Deposited(
        bytes32 indexed claimToken,
        address indexed sender,
        uint96 amount,
        uint64 expiresAt
    );
    event Claimed(
        bytes32 indexed claimToken,
        address indexed recipient,
        uint96 grossAmount,
        uint256 nonce
    );
    event Refunded(
        bytes32 indexed claimToken,
        address indexed sender,
        uint96 amount
    );

    // ============ Errors ============

    error ZeroAmount();
    error ZeroToken();
    error AlreadyExists();
    error NotPending();
    error AlreadyExpired();
    error NotYetExpired();
    error InvalidSignature();
    error PoolRelayerNotConfigured();

    // ============ Constructor ============

    constructor(address usdc, address pool) {
        if (usdc == address(0) || pool == address(0)) revert ZeroToken();
        USDC = IERC20(usdc);
        POOL = IX402PrivacyPool(pool);
    }

    // ============ Core ============

    /**
     * @notice Open an escrow for an SMS payment.
     * @param claimToken 32-byte unguessable id, also delivered via SMS.
     * @param amount     USDC amount in token units (6 decimals).
     *
     * Caller must have approved this contract for at least `amount` USDC.
     */
    function depositFor(bytes32 claimToken, uint96 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (escrows[claimToken].status != Status.None) revert AlreadyExists();

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        uint64 expiresAt = uint64(block.timestamp) + EXPIRY_SECONDS;
        escrows[claimToken] = Escrow({
            sender: msg.sender,
            amount: amount,
            expiresAt: expiresAt,
            status: Status.Pending,
            recipient: address(0)
        });

        emit Deposited(claimToken, msg.sender, amount, expiresAt);
    }

    /**
     * @notice Claim an open escrow. The caller is the recipient and must
     *         submit an EIP-191 personal_sign signature over the canonical
     *         claim commitment (see _claimDigest).
     * @param claimToken The token from the SMS.
     * @param recipientSig 65-byte EIP-191 signature.
     */
    function claim(bytes32 claimToken, bytes calldata recipientSig) external nonReentrant {
        Escrow storage e = escrows[claimToken];
        if (e.status != Status.Pending) revert NotPending();
        if (block.timestamp >= e.expiresAt) revert AlreadyExpired();

        bytes32 digest = _claimDigest(claimToken, msg.sender);
        address signer = ECDSA.recover(digest, recipientSig);
        if (signer != msg.sender) revert InvalidSignature();

        if (!POOL.isRelayer(address(this))) revert PoolRelayerNotConfigured();

        // Capture amount before we wipe storage; flip status first to
        // protect against any reentry attempts even though both external
        // calls are to a trusted pool.
        uint96 amount = e.amount;
        e.status = Status.Claimed;
        e.recipient = msg.sender;

        // Settle via the privacy pool.
        // 1. Credit our pool balance.
        USDC.forceApprove(address(POOL), amount);
        POOL.deposit(address(USDC), amount);

        // 2. Upload an opaque proof keyed on (claimToken, timestamp).
        //    The pool does not verify the proof contents; it only requires
        //    a unique nonce. Empty bytes are acceptable.
        uint256 nonce = uint256(
            keccak256(abi.encodePacked(claimToken, block.timestamp))
        );
        POOL.uploadProof(nonce, amount, address(USDC), "", "", "");

        // 3. Pull from pool to recipient. The pool deducts its maintenance
        //    fee internally; recipient receives net.
        bytes32 proofId = POOL.getProofId(nonce);
        POOL.externalTransfer(proofId, msg.sender, 0);

        emit Claimed(claimToken, msg.sender, amount, nonce);
    }

    /**
     * @notice Refund an expired, unclaimed escrow to the original sender.
     *         Permissionless — anyone can trigger this once the expiry has
     *         passed so funds cannot get stuck behind any relay or admin.
     */
    function refund(bytes32 claimToken) external nonReentrant {
        Escrow storage e = escrows[claimToken];
        if (e.status != Status.Pending) revert NotPending();
        if (block.timestamp < e.expiresAt) revert NotYetExpired();

        uint96 amount = e.amount;
        address sender = e.sender;
        e.status = Status.Refunded;

        USDC.safeTransfer(sender, amount);
        emit Refunded(claimToken, sender, amount);
    }

    // ============ Views ============

    function getEscrow(bytes32 claimToken)
        external
        view
        returns (
            address sender,
            uint96 amount,
            uint64 expiresAt,
            Status status,
            address recipient
        )
    {
        Escrow storage e = escrows[claimToken];
        return (e.sender, e.amount, e.expiresAt, e.status, e.recipient);
    }

    function isPoolRelayer() external view returns (bool) {
        return POOL.isRelayer(address(this));
    }

    // ============ Signature helpers ============

    /**
     * @notice The canonical commitment a recipient signs to claim.
     *         Format is intentionally human-readable so wallets can render
     *         the personal_sign message without surprises.
     */
    function claimMessage(bytes32 claimToken, address recipient)
        public
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                "BASEUSDP SMS Claim v1\n",
                "ClaimToken: ",
                Strings.toHexString(uint256(claimToken), 32),
                "\n",
                "Recipient: ",
                Strings.toHexString(uint160(recipient), 20)
            )
        );
    }

    function _claimDigest(bytes32 claimToken, address recipient)
        internal
        pure
        returns (bytes32)
    {
        // Use the bytes overload so the EIP-191 prefix carries the actual
        // message length (matches what a wallet's `personal_sign` produces).
        // The bytes32 overload hard-codes "\n32" which is only correct when
        // the caller is signing a pre-hashed value.
        bytes memory message = bytes(claimMessage(claimToken, recipient));
        return message.toEthSignedMessageHash();
    }
}
