import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const identityAddress = "0x635107f6cCe12044a4DFBB896b7E3d3ED42B33C9";

  console.log("Deployer:", deployer.address);
  console.log("AgentIdentityRegistry (already deployed):", identityAddress);

  console.log("\n--- Deploying AgentReputationRegistry ---");
  const Rep = await ethers.getContractFactory("AgentReputationRegistry");
  const rep = await Rep.deploy(identityAddress);
  await rep.waitForDeployment();
  const repAddress = await rep.getAddress();
  console.log("AgentReputationRegistry deployed to:", repAddress);

  console.log("\n--- Adding authorized reporter ---");
  const tx = await rep.addReporter(deployer.address);
  await tx.wait();
  console.log("Reporter added:", deployer.address);

  console.log("\n=== Set these in Vercel ===");
  console.log(`AGENT_IDENTITY_REGISTRY_ADDRESS=${identityAddress}`);
  console.log(`AGENT_REPUTATION_REGISTRY_ADDRESS=${repAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
