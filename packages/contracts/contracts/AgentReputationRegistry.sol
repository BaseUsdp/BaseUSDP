// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC8004Reputation.sol";

/**
 * @title IAgentIdentityRegistry
 * @notice Minimal interface for checking agent registration
 */
interface IAgentIdentityRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title AgentReputationRegistry
 * @notice ERC-8004 Agent Reputation Registry — tracks trust signals and transaction history
 * @dev Authorized reporter model. Trust score: signal ratio (0-100) weighted with activity bonus.
 */
contract AgentReputationRegistry is Ownable, IERC8004Reputation {
    IAgentIdentityRegistry public identityRegistry;

    mapping(address => bool) public authorizedReporters;

    mapping(uint256 => uint256) public positiveSignals;
    mapping(uint256 => uint256) public negativeSignals;
    mapping(uint256 => uint256) public txCount;
    mapping(uint256 => uint256) public totalVolume;

    modifier onlyReporter() {
        if (!authorizedReporters[msg.sender]) revert UnauthorizedReporter();
        _;
    }

    modifier validToken(uint256 tokenId) {
        // Will revert via ERC721 if token doesn't exist
        try identityRegistry.ownerOf(tokenId) returns (address owner) {
            if (owner == address(0)) revert InvalidTokenId();
        } catch {
            revert InvalidTokenId();
        }
        _;
    }

    constructor(address _identityRegistry) Ownable(msg.sender) {
        identityRegistry = IAgentIdentityRegistry(_identityRegistry);
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function postSignal(uint256 tokenId, bool positive, string calldata reason) external onlyReporter validToken(tokenId) {
        if (positive) {
            positiveSignals[tokenId]++;
        } else {
            negativeSignals[tokenId]++;
        }

        emit SignalPosted(tokenId, positive, reason, msg.sender);
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function recordTransaction(uint256 tokenId, uint256 amountUSDC6Dec) external onlyReporter validToken(tokenId) {
        txCount[tokenId]++;
        totalVolume[tokenId] += amountUSDC6Dec;

        emit TransactionRecorded(tokenId, amountUSDC6Dec, msg.sender);
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function getReputation(uint256 tokenId) external view returns (Reputation memory) {
        return Reputation({
            positiveSignals: positiveSignals[tokenId],
            negativeSignals: negativeSignals[tokenId],
            txCount: txCount[tokenId],
            totalVolume: totalVolume[tokenId],
            trustScore: _computeTrustScore(tokenId)
        });
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function getTrustScore(uint256 tokenId) external view returns (uint256) {
        return _computeTrustScore(tokenId);
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function addReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = true;
        emit ReporterAdded(reporter);
    }

    /**
     * @inheritdoc IERC8004Reputation
     */
    function removeReporter(address reporter) external onlyOwner {
        authorizedReporters[reporter] = false;
        emit ReporterRemoved(reporter);
    }

    /**
     * @dev Compute trust score: signal ratio (0-100) weighted with activity bonus
     *      Base score = positiveSignals / totalSignals * 70
     *      Activity bonus = min(txCount, 30) (capped at 30 points)
     *      Total = base + activity bonus, capped at 100
     */
    function _computeTrustScore(uint256 tokenId) internal view returns (uint256) {
        uint256 pos = positiveSignals[tokenId];
        uint256 neg = negativeSignals[tokenId];
        uint256 total = pos + neg;

        // Base score from signal ratio (0-70)
        uint256 baseScore;
        if (total == 0) {
            baseScore = 50; // Neutral starting score
        } else {
            baseScore = (pos * 70) / total;
        }

        // Activity bonus (0-30) based on transaction count
        uint256 activityBonus = txCount[tokenId];
        if (activityBonus > 30) {
            activityBonus = 30;
        }

        uint256 score = baseScore + activityBonus;
        if (score > 100) {
            score = 100;
        }

        return score;
    }
}
