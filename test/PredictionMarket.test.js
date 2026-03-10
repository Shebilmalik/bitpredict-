const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictionMarket", function () {
  let market, owner, alice, bob, charlie, resolver;
  const ONE_HOUR = 3600, ONE_DAY = 86400;
  const E1 = ethers.parseEther("1"), E05 = ethers.parseEther("0.5"), E2 = ethers.parseEther("2");

  beforeEach(async () => {
    [owner, alice, bob, charlie, resolver] = await ethers.getSigners();
    const F = await ethers.getContractFactory("PredictionMarket");
    market = await F.deploy();
  });

  describe("Market Creation", () => {
    it("creates with correct data", async () => {
      await market.createMarket("Will BTC reach $100k?", "crypto", ONE_DAY, "");
      const m = await market.getMarket(1);
      expect(m.question).to.equal("Will BTC reach $100k?");
      expect(m.resolved).to.be.false;
    });
    it("increments marketCount", async () => {
      await market.createMarket("Q1?", "crypto", ONE_DAY, "");
      await market.createMarket("Q2?", "sports", ONE_DAY, "");
      expect(await market.marketCount()).to.equal(2n);
    });
    it("rejects empty question", async () => {
      await expect(market.createMarket("","crypto",ONE_DAY,"")).to.be.revertedWith("Empty question");
    });
    it("rejects duration < 1h", async () => {
      await expect(market.createMarket("Q?","crypto",3599,"")).to.be.revertedWith("Min 1 hour");
    });
  });

  describe("Betting", () => {
    beforeEach(async () => { await market.createMarket("Test?","crypto",ONE_DAY,""); });
    it("accepts YES bet", async () => {
      await market.connect(alice).betYes(1, { value: E1 });
      const m = await market.getMarket(1);
      expect(m.yesPool).to.equal(E1);
    });
    it("accepts NO bet", async () => {
      await market.connect(bob).betNo(1, { value: E2 });
      const m = await market.getMarket(1);
      expect(m.noPool).to.equal(E2);
    });
    it("rejects zero bet", async () => {
      await expect(market.connect(alice).betYes(1, { value: 0 })).to.be.revertedWith("Zero value");
    });
    it("rejects bet after end", async () => {
      await time.increase(ONE_DAY+1);
      await expect(market.connect(alice).betYes(1,{value:E1})).to.be.revertedWith("Market ended");
    });
  });

  describe("Resolution & Claiming", () => {
    beforeEach(async () => {
      await market.createMarket("Q?","crypto",ONE_HOUR,"");
      await market.connect(alice).betYes(1, { value: E1 });
      await market.connect(bob).betNo(1,   { value: E1 });
      await time.increase(ONE_HOUR+1);
    });
    it("owner can resolve YES", async () => {
      await market.resolveMarket(1, true);
      const m = await market.getMarket(1);
      expect(m.resolved).to.be.true;
    });
    it("rejects non-resolver", async () => {
      await expect(market.connect(alice).resolveMarket(1,true)).to.be.revertedWith("Not resolver");
    });
    it("YES winner gets payout", async () => {
      await market.resolveMarket(1, true);
      const before = await ethers.provider.getBalance(alice.address);
      const tx = await market.connect(alice).claim(1);
      const rc = await tx.wait();
      const after = await ethers.provider.getBalance(alice.address);
      const net = after - before + rc.gasUsed * rc.gasPrice;
      expect(net).to.be.closeTo(ethers.parseEther("1.96"), ethers.parseEther("0.01"));
    });
    it("loser cannot claim", async () => {
      await market.resolveMarket(1, true);
      await expect(market.connect(bob).claim(1)).to.be.revertedWith("No NO bet");
    });
  });

  describe("Cancellation", () => {
    it("creator cancels and bettor gets refund", async () => {
      await market.createMarket("Q?","crypto",ONE_DAY,"");
      await market.connect(alice).betYes(1, { value: E1 });
      await market.cancelMarket(1);
      const before = await ethers.provider.getBalance(alice.address);
      const tx = await market.connect(alice).claim(1);
      const rc = await tx.wait();
      const after = await ethers.provider.getBalance(alice.address);
      expect(after - before + rc.gasUsed * rc.gasPrice).to.equal(E1);
    });
  });
});
