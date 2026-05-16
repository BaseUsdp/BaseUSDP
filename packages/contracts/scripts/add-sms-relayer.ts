import { ethers } from "hardhat";

async function main() {
  const POOL = "0xAa030643f1BAdab1C5aB272a2dcD583b0F832E3C";
  const SMS_ESCROW = "0x0Ffa490E8747341dc707d7cFADC74076e0E125E0";
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const pool = await ethers.getContractAt("X402PrivacyPool", POOL);
  const already = await pool.isRelayer(SMS_ESCROW);
  if (already) {
    console.log("Already a relayer — no tx needed.");
    return;
  }

  const tx = await pool.addRelayer(SMS_ESCROW);
  console.log("addRelayer tx:", tx.hash);
  const rc = await tx.wait();
  console.log("Mined in block:", rc?.blockNumber);

  const nowRelayer = await pool.isRelayer(SMS_ESCROW);
  console.log("isRelayer post-tx:", nowRelayer);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
