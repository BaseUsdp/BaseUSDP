import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying X402PrivacyPool with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy the contract with deployer as fee recipient
  const X402PrivacyPool = await ethers.getContractFactory("X402PrivacyPool");
  const pool = await X402PrivacyPool.deploy(deployer.address);

  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  console.log("X402PrivacyPool deployed to:", poolAddress);

  // Add USDC as supported token based on network
  const chainId = (await ethers.provider.getNetwork()).chainId;

  let usdcAddress: string;
  if (chainId === 8453n) {
    usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC
    console.log("Adding Base Mainnet USDC as supported token...");
  } else if (chainId === 84532n) {
    usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC
    console.log("Adding Base Sepolia USDC as supported token...");
  } else {
    console.log("Local/unknown network (chainId:", chainId.toString(), "), skipping USDC setup");
    console.log("\n=== Deployment Complete ===");
    console.log("Contract Address:", poolAddress);
    console.log("Fee Recipient:", deployer.address);
    return;
  }

  const tx = await pool.addSupportedToken(usdcAddress);
  await tx.wait();
  console.log("USDC added as supported token:", usdcAddress);

  console.log("\n=== Deployment Complete ===");
  console.log("Contract Address:", poolAddress);
  console.log("USDC Address:", usdcAddress);
  console.log("Fee Recipient:", deployer.address);
  console.log("\nSet this in your .env:");
  console.log(`X402_PRIVACY_POOL_ADDRESS=${poolAddress}`);
  console.log("\nVerify contract with:");
  console.log(`npx hardhat verify --network baseSepolia ${poolAddress} ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
