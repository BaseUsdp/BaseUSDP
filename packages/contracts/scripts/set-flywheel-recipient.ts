import { ethers } from "hardhat";

/**
 * Repoint the live X402PrivacyPool's fee recipient to the dedicated
 * BASEUSDP flywheel wallet.
 *
 * Reads:
 *   X402_PRIVACY_POOL_ADDRESS   — already-deployed pool
 *   FLYWHEEL_WALLET_ADDRESS     — new fee destination
 *
 * Requires the connected signer (DEPLOYER_PRIVATE_KEY) to be the pool owner.
 * This is a one-shot config change — it does not redeploy or migrate state,
 * so existing balances, proofs, and relayer relationships are untouched.
 *
 * Run:
 *   npx hardhat run scripts/set-flywheel-recipient.ts --network base
 */
async function main() {
  const pool = process.env.X402_PRIVACY_POOL_ADDRESS;
  const flywheel = process.env.FLYWHEEL_WALLET_ADDRESS;

  if (!pool || !ethers.isAddress(pool)) {
    console.error("X402_PRIVACY_POOL_ADDRESS is missing or invalid");
    process.exit(1);
  }
  if (!flywheel || !ethers.isAddress(flywheel)) {
    console.error("FLYWHEEL_WALLET_ADDRESS is missing or invalid");
    process.exit(1);
  }

  const [signer] = await ethers.getSigners();
  console.log("Signer:        ", signer.address);
  console.log("Privacy pool:  ", pool);
  console.log("New recipient: ", flywheel);

  const abi = [
    "function feeRecipient() view returns (address)",
    "function owner() view returns (address)",
    "function setFeeRecipient(address _feeRecipient) external",
  ];

  const contract = new ethers.Contract(pool, abi, signer);

  const [currentRecipient, currentOwner] = await Promise.all([
    contract.feeRecipient(),
    contract.owner(),
  ]);
  console.log("Current owner: ", currentOwner);
  console.log("Current recipient:", currentRecipient);

  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error(
      `Signer ${signer.address} is not the contract owner (${currentOwner}). Aborting.`
    );
    process.exit(1);
  }

  if (currentRecipient.toLowerCase() === flywheel.toLowerCase()) {
    console.log("Fee recipient already set to the flywheel wallet. Nothing to do.");
    return;
  }

  console.log("\nSending setFeeRecipient tx...");
  const tx = await contract.setFeeRecipient(flywheel);
  console.log("tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block", receipt?.blockNumber);

  const updated = await contract.feeRecipient();
  console.log("\nNew fee recipient:", updated);

  if (updated.toLowerCase() !== flywheel.toLowerCase()) {
    console.error("WARNING: on-chain recipient does not match expected flywheel address.");
    process.exit(1);
  }

  console.log("\nDone. All future poolFee transfers route to the flywheel wallet.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
