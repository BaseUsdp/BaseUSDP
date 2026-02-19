import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DepositRouter with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Collection wallet receives ETH from deposits
  const collectionWallet = process.env.COLLECTION_WALLET_ADDRESS_BASE;
  if (!collectionWallet) {
    console.error("Set COLLECTION_WALLET_ADDRESS_BASE in your .env");
    process.exit(1);
  }
  console.log("Collection wallet:", collectionWallet);

  const DepositRouter = await ethers.getContractFactory("DepositRouter");
  const router = await DepositRouter.deploy(collectionWallet);

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("\n=== Deployment Complete ===");
  console.log("DepositRouter deployed to:", routerAddress);
  console.log("Collection Wallet:", collectionWallet);
  console.log("\nSet this in your .env:");
  console.log(`DEPOSIT_ROUTER_ADDRESS=${routerAddress}`);
  console.log("\nVerify contract with:");
  console.log(`npx hardhat verify --network base ${routerAddress} ${collectionWallet}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
