import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const BASE_MAINNET_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 84532,
    },
    base: {
      url: BASE_MAINNET_RPC,
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 8453,
    },
    fhenixTestnet: {
      url: process.env.FHENIX_TESTNET_RPC_URL || "https://testnet.fhenix.zone",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42069,
    },
  },
  etherscan: {
    apiKey: BASESCAN_API_KEY,
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;

