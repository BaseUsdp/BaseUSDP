// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DepositRouter
 * @notice Routes USDC deposits + ETH gas funding in a single user transaction.
 * @dev User approves this contract once, then each deposit is a single tx:
 *      depositWithGas(holdingWallet, amount) with msg.value ETH.
 *      - USDC is pulled from user to holdingWallet via safeTransferFrom
 *      - ETH is forwarded to collectionWallet for backend gas funding
 */
contract DepositRouter is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public collectionWallet;

    error ZeroAmount();
    error ZeroAddress();
    error EthTransferFailed();

    event DepositWithGas(
        address indexed user,
        address indexed holdingWallet,
        uint256 usdcAmount,
        uint256 ethAmount
    );
    event CollectionWalletUpdated(address indexed oldWallet, address indexed newWallet);

    constructor(address _usdc, address _collectionWallet) Ownable(msg.sender) {
        if (_usdc == address(0) || _collectionWallet == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        collectionWallet = _collectionWallet;
    }

    /**
     * @notice Deposit USDC to a holding wallet and forward ETH to collection wallet
     * @param holdingWallet The holding wallet to receive USDC
     * @param amount The USDC amount (6 decimals)
     */
    function depositWithGas(address holdingWallet, uint256 amount) external payable nonReentrant {
        if (holdingWallet == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Pull USDC from user to holding wallet
        usdc.safeTransferFrom(msg.sender, holdingWallet, amount);

        // Forward ETH to collection wallet
        if (msg.value > 0) {
            (bool success, ) = collectionWallet.call{value: msg.value}("");
            if (!success) revert EthTransferFailed();
        }

        emit DepositWithGas(msg.sender, holdingWallet, amount, msg.value);
    }

    /**
     * @notice Update collection wallet address (owner only)
     */
    function setCollectionWallet(address _collectionWallet) external onlyOwner {
        if (_collectionWallet == address(0)) revert ZeroAddress();
        address old = collectionWallet;
        collectionWallet = _collectionWallet;
        emit CollectionWalletUpdated(old, _collectionWallet);
    }

    /**
     * @notice Recover accidentally sent ERC20 tokens (owner only)
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Recover accidentally sent ETH (owner only)
     */
    function recoverETH() external onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        if (!success) revert EthTransferFailed();
    }
}
