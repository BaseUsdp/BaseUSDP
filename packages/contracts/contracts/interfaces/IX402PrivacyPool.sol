// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IX402PrivacyPool
 * @notice Minimal interface for the BASEUSDP privacy pool, exposing only the
 *         entry points the SMSEscrow adapter calls. The full pool contract
 *         lives in X402PrivacyPool.sol and is unchanged.
 */
interface IX402PrivacyPool {
    function deposit(address token, uint256 amount) external;

    function uploadProof(
        uint256 nonce,
        uint256 amount,
        address token,
        bytes calldata proofBytes,
        bytes calldata commitmentBytes,
        bytes calldata blindingFactorBytes
    ) external;

    function externalTransfer(
        bytes32 proofId,
        address recipient,
        uint256 relayerFee
    ) external;

    function getProofId(uint256 nonce) external pure returns (bytes32);

    function isRelayer(address account) external view returns (bool);
}
