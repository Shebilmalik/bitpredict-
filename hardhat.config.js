require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: {},
    opnet_testnet: {
      url: process.env.OPNET_TESTNET_RPC || "https://testnet.opnet.org",
      chainId: Number(process.env.OPNET_TESTNET_CHAIN_ID || 3),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    opnet_mainnet: {
      url: process.env.OPNET_MAINNET_RPC || "https://rpc.opnet.org",
      chainId: Number(process.env.OPNET_MAINNET_CHAIN_ID || 1),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
