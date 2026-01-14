import { writeFileSync } from "fs";
import { join } from "path";

// This script saves deployed contract addresses to a file
// Run this after successful deployment

const addresses = {
  tokenAddress: process.env.TOKEN_ADDRESS || "",
  facilitatorAddress: process.env.FACILITATOR_ADDRESS || "",
};

const addressesPath = join(__dirname, "../deployed-addresses.json");
writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
console.log("Contract addresses saved to:", addressesPath);

