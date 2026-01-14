import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy VoidFHERC20
  const VoidFHERC20 = await ethers.getContractFactory("VoidFHERC20");
  const token = await VoidFHERC20.deploy(
    "Void402 Token",
    "VOID",
    ethers.parseEther("1000000") // 1M initial supply
  );
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("VoidFHERC20 deployed to:", tokenAddress);

  // Deploy Void402Facilitator
  const Void402Facilitator = await ethers.getContractFactory("Void402Facilitator");
  const facilitator = await Void402Facilitator.deploy(tokenAddress);
  await facilitator.waitForDeployment();
  const facilitatorAddress = await facilitator.getAddress();
  console.log("Void402Facilitator deployed to:", facilitatorAddress);

  console.log("\n=== Deployment Summary ===");
  console.log("VoidFHERC20:", tokenAddress);
  console.log("Void402Facilitator:", facilitatorAddress);
  console.log("\nSave these addresses for backend configuration!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

