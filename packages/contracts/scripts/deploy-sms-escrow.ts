import { ethers } from "hardhat";

const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying SMSEscrow with account:", deployer.address);
  console.log(
    "Account balance:",
    (await ethers.provider.getBalance(deployer.address)).toString()
  );

  const pool = process.env.X402_PRIVACY_POOL_ADDRESS;
  if (!pool) {
    console.error("Set X402_PRIVACY_POOL_ADDRESS in your .env");
    process.exit(1);
  }
  if (!ethers.isAddress(pool)) {
    console.error(`X402_PRIVACY_POOL_ADDRESS is not a valid address: ${pool}`);
    process.exit(1);
  }

  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const usdc =
    chainId === 8453
      ? USDC_BASE_MAINNET
      : chainId === 84532
      ? USDC_BASE_SEPOLIA
      : process.env.USDC_ADDRESS;
  if (!usdc) {
    console.error(
      `Unsupported chainId ${chainId}. Set USDC_ADDRESS in your .env to override.`
    );
    process.exit(1);
  }

  console.log("Chain ID:    ", chainId);
  console.log("USDC token:  ", usdc);
  console.log("Privacy pool:", pool);

  const SMSEscrow = await ethers.getContractFactory("SMSEscrow");
  const escrow = await SMSEscrow.deploy(usdc, pool);

  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("\n=== Deployment Complete ===");
  console.log("SMSEscrow deployed to:", escrowAddress);

  console.log("\nSet this in your Vercel env:");
  console.log(`SMS_ESCROW_ADDRESS=${escrowAddress}`);

  console.log("\nOne pool-side step required before claims will work:");
  console.log(
    `  call X402PrivacyPool(${pool}).addRelayer(${escrowAddress}) from the pool owner.`
  );
  console.log(
    "  This is additive — existing relayers and flows are unaffected."
  );

  console.log("\nVerify on Basescan with:");
  console.log(
    `  npx hardhat verify --network base ${escrowAddress} ${usdc} ${pool}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
