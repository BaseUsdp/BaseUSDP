import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Agent Registries with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Step 1: Deploy AgentIdentityRegistry
  console.log("\n--- Deploying AgentIdentityRegistry ---");
  const IdentityRegistry = await ethers.getContractFactory("AgentIdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  const identityAddress = await identity.getAddress();
  console.log("AgentIdentityRegistry deployed to:", identityAddress);

  // Step 2: Deploy AgentReputationRegistry with identity registry address
  console.log("\n--- Deploying AgentReputationRegistry ---");
  const ReputationRegistry = await ethers.getContractFactory("AgentReputationRegistry");
  const reputation = await ReputationRegistry.deploy(identityAddress);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log("AgentReputationRegistry deployed to:", reputationAddress);

  // Step 3: Add backend relayer as authorized reporter (if env var is set)
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("\n--- Adding authorized reporter ---");
  const tx = await reputation.addReporter(relayerAddress);
  await tx.wait();
  console.log("Authorized reporter added:", relayerAddress);

  // Output
  console.log("\n=== Deployment Complete ===");
  console.log("AgentIdentityRegistry:", identityAddress);
  console.log("AgentReputationRegistry:", reputationAddress);
  console.log("Authorized Reporter:", relayerAddress);

  console.log("\nSet these in your .env:");
  console.log(`AGENT_IDENTITY_REGISTRY_ADDRESS=${identityAddress}`);
  console.log(`AGENT_REPUTATION_REGISTRY_ADDRESS=${reputationAddress}`);

  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network baseSepolia ${identityAddress}`);
  console.log(`npx hardhat verify --network baseSepolia ${reputationAddress} ${identityAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
