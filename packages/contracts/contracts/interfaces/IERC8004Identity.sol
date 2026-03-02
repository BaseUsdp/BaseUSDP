// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Identity
 * @notice Interface for ERC-8004 Agent Identity Registry
 * @dev On-chain agent identity passport as soulbound ERC721
 */
interface IERC8004Identity {
    // Events
    event AgentRegistered(uint256 indexed tokenId, address indexed operator, string metadataURI);
    event AgentVerified(uint256 indexed tokenId);
    event AgentRevoked(uint256 indexed tokenId);
    event MetadataUpdated(uint256 indexed tokenId, string metadataURI);

    // Errors
    error AlreadyRegistered();
    error AlreadyVerified();
    error AlreadyRevoked();
    error NotRegistered();
    error NotTokenOwner();

    /**
     * @notice Register a new agent and mint an identity passport NFT
     * @param metadataURI URI pointing to agent metadata JSON
     * @return tokenId The minted passport token ID
     */
    function registerAgent(string calldata metadataURI) external returns (uint256);

    /**
     * @notice Verify an agent's passport (owner only)
     * @param tokenId The passport token ID to verify
     */
    function verifyAgent(uint256 tokenId) external;

    /**
     * @notice Revoke an agent's passport (owner only)
     * @param tokenId The passport token ID to revoke
     */
    function revokeAgent(uint256 tokenId) external;

    /**
     * @notice Check if an agent's passport is verified
     * @param tokenId The passport token ID
     * @return True if the agent is verified
     */
    function isAgentVerified(uint256 tokenId) external view returns (bool);

    /**
     * @notice Check if an agent's passport is revoked
     * @param tokenId The passport token ID
     * @return True if the agent is revoked
     */
    function isAgentRevoked(uint256 tokenId) external view returns (bool);

    /**
     * @notice Get the passport token ID for an operator address
     * @param operator The agent's address
     * @return The passport token ID (0 if not registered)
     */
    function getPassportId(address operator) external view returns (uint256);

    /**
     * @notice Update metadata URI for a passport (token owner only)
     * @param tokenId The passport token ID
     * @param metadataURI New metadata URI
     */
    function updateMetadata(uint256 tokenId, string calldata metadataURI) external;
}
