const { ethers, network } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("\n════════════════════════════════════════");
  console.log("  BitPredict — Deployment");
  console.log("════════════════════════════════════════");
  console.log("Network  :", network.name);
  console.log("Deployer :", deployer.address);
  console.log("Balance  :", ethers.formatEther(bal), "BTC\n");

  const Factory = await ethers.getContractFactory("PredictionMarket");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("✅ PredictionMarket deployed:", addr);

  const seeds = [
    { q: "Will BTC reach $100,000 before May 2025?",          cat: "crypto", days: 7  },
    { q: "Will Ethereum ETF get SEC approval in Q2 2025?",    cat: "crypto", days: 14 },
    { q: "Will Bitcoin dominance stay above 50% this month?", cat: "crypto", days: 30 },
    { q: "Will OP_NET launch mainnet in 2025?",               cat: "crypto", days: 30 },
  ];

  console.log("\nSeeding markets...");
  for (const s of seeds) {
    const tx = await contract.createMarket(s.q, s.cat, s.days * 86400, "");
    await tx.wait();
    console.log(" ✓", s.q.slice(0, 55) + "...");
  }

  const info = { address: addr, network: network.name, deployer: deployer.address, timestamp: new Date().toISOString() };
  fs.writeFileSync("deployment.json", JSON.stringify(info, null, 2));
  console.log("\n════════════════════════════════════════");
  console.log("  Done! Add to your .env:");
  console.log(`  VITE_CONTRACT_ADDRESS=${addr}`);
  console.log("════════════════════════════════════════\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
