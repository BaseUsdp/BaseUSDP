import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DepositRouter with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const chainId = (await ethers.provider.getNetwork()).chainId;

  let usdcAddress: string;
  if (chainId === 8453n) {
    usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC
    console.log("Using Base Mainnet USDC:", usdcAddress);
  } else if (chainId === 84532n) {
    usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
    console.log("Using Base Sepolia USDC:", usdcAddress);
  } else {
    console.error("Unsupported network. Use baseSepolia or base.");
    process.exit(1);
  }

  // Collection wallet receives ETH from deposits
  const collectionWallet = process.env.COLLECTION_WALLET_ADDRESS_BASE;
  if (!collectionWallet) {
    console.error("Set COLLECTION_WALLET_ADDRESS_BASE in your .env");
    process.exit(1);
  }
  console.log("Collection wallet:", collectionWallet);

  const DepositRouter = await ethers.getContractFactory("DepositRouter");
  const router = await DepositRouter.deploy(usdcAddress, collectionWallet);

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("\n=== Deployment Complete ===");
  console.log("DepositRouter deployed to:", routerAddress);
  console.log("USDC Address:", usdcAddress);
  console.log("Collection Wallet:", collectionWallet);
  console.log("\nSet this in your .env:");
  console.log(`DEPOSIT_ROUTER_ADDRESS=${routerAddress}`);
  console.log("\nVerify contract with:");
  console.log(`npx hardhat verify --network base ${routerAddress} ${usdcAddress} ${collectionWallet}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
