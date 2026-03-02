// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";
import "./interfaces/IERC8004Identity.sol";

/**
 * @title AgentIdentityRegistry
 * @notice ERC-8004 Agent Identity Passport — soulbound ERC721 for on-chain agent identity
 * @dev One passport per address. Verify/revoke by contract owner.
 */
contract AgentIdentityRegistry is ERC721, Ownable, IERC4906, IERC8004Identity {
    uint256 private _nextTokenId;

    // tokenId => metadata URI
    mapping(uint256 => string) private _tokenURIs;

    // operator address => tokenId
    mapping(address => uint256) private _passportIds;

    // tokenId => verified
    mapping(uint256 => bool) private _verified;

    // tokenId => revoked
    mapping(uint256 => bool) private _revoked;

    constructor() ERC721("Agent Identity Passport", "AIP") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function registerAgent(string calldata metadataURI) external returns (uint256) {
        if (_passportIds[msg.sender] != 0) revert AlreadyRegistered();

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _tokenURIs[tokenId] = metadataURI;
        _passportIds[msg.sender] = tokenId;

        emit AgentRegistered(tokenId, msg.sender, metadataURI);
        return tokenId;
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function verifyAgent(uint256 tokenId) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert NotRegistered();
        if (_verified[tokenId]) revert AlreadyVerified();

        _verified[tokenId] = true;
        emit AgentVerified(tokenId);
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function revokeAgent(uint256 tokenId) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert NotRegistered();
        if (_revoked[tokenId]) revert AlreadyRevoked();

        _revoked[tokenId] = true;
        emit AgentRevoked(tokenId);
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function isAgentVerified(uint256 tokenId) external view returns (bool) {
        return _verified[tokenId];
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function isAgentRevoked(uint256 tokenId) external view returns (bool) {
        return _revoked[tokenId];
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function getPassportId(address operator) external view returns (uint256) {
        return _passportIds[operator];
    }

    /**
     * @inheritdoc IERC8004Identity
     */
    function updateMetadata(uint256 tokenId, string calldata metadataURI) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        _tokenURIs[tokenId] = metadataURI;
        emit MetadataUpdated(tokenId, metadataURI);
        emit MetadataUpdate(tokenId);
    }

    /**
     * @dev Returns the token URI for a given token ID
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, IERC165) returns (bool) {
        return
            interfaceId == bytes4(0x49064906) || // IERC4906
            super.supportsInterface(interfaceId);
    }
}
