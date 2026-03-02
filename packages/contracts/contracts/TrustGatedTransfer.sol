// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IERC8004Identity.sol";
import "./interfaces/IERC8004Reputation.sol";

/**
 * @title TrustGatedTransfer
 * @notice Optional on-chain trust-gating modifier for payment contracts
 * @dev Checks agent identity and reputation registries before allowing transfers
 */
abstract contract TrustGatedTransfer {
    IERC8004Identity public immutable identityRegistry;
    IERC8004Reputation public immutable reputationRegistry;
    uint256 public minimumTrustScore;

    error AgentNotRegistered();
    error AgentRevoked();
    error InsufficientTrustScore(uint256 score, uint256 required);

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        uint256 _minimumTrustScore
    ) {
        identityRegistry = IERC8004Identity(_identityRegistry);
        reputationRegistry = IERC8004Reputation(_reputationRegistry);
        minimumTrustScore = _minimumTrustScore;
    }

    /**
     * @dev Modifier to gate transfers by agent trust score and revocation status
     * @param agent The agent's wallet address
     */
    modifier requiresTrust(address agent) {
        uint256 passportId = identityRegistry.getPassportId(agent);
        if (passportId == 0) revert AgentNotRegistered();
        if (identityRegistry.isAgentRevoked(passportId)) revert AgentRevoked();

        uint256 score = reputationRegistry.getTrustScore(passportId);
        if (score < minimumTrustScore) revert InsufficientTrustScore(score, minimumTrustScore);

        _;
    }
}
