// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Reputation
 * @notice Interface for ERC-8004 Agent Reputation Registry
 * @dev Tracks agent reputation signals, transactions, and trust scores
 */
interface IERC8004Reputation {
    // Structs
    struct Reputation {
        uint256 positiveSignals;
        uint256 negativeSignals;
        uint256 txCount;
        uint256 totalVolume;
        uint256 trustScore;
    }

    // Events
    event SignalPosted(uint256 indexed tokenId, bool positive, string reason, address indexed reporter);
    event TransactionRecorded(uint256 indexed tokenId, uint256 amountUSDC6Dec, address indexed reporter);
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);

    // Errors
    error UnauthorizedReporter();
    error InvalidTokenId();

    /**
     * @notice Post a reputation signal for an agent
     * @param tokenId The agent's passport token ID
     * @param positive True for positive signal, false for negative
     * @param reason Description of the signal
     */
    function postSignal(uint256 tokenId, bool positive, string calldata reason) external;

    /**
     * @notice Record a transaction for an agent
     * @param tokenId The agent's passport token ID
     * @param amountUSDC6Dec Transaction amount in USDC (6 decimals)
     */
    function recordTransaction(uint256 tokenId, uint256 amountUSDC6Dec) external;

    /**
     * @notice Get full reputation data for an agent
     * @param tokenId The agent's passport token ID
     * @return The agent's reputation data
     */
    function getReputation(uint256 tokenId) external view returns (Reputation memory);

    /**
     * @notice Get computed trust score for an agent
     * @param tokenId The agent's passport token ID
     * @return Trust score from 0-100
     */
    function getTrustScore(uint256 tokenId) external view returns (uint256);

    /**
     * @notice Add an authorized reporter
     * @param reporter Address to authorize
     */
    function addReporter(address reporter) external;

    /**
     * @notice Remove an authorized reporter
     * @param reporter Address to deauthorize
     */
    function removeReporter(address reporter) external;
}
