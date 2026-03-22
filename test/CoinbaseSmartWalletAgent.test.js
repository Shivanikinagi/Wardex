const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoinbaseSmartWalletAgent", function () {
  let wardex;
  let ensResolver;
  let walletAgent;
  let owner;
  let agent;
  let user2;

  beforeEach(async function () {
    [owner, agent, user2] = await ethers.getSigners();

    // Deploy ENS Resolver
    const ENSAgentResolver = await ethers.getContractFactory(
      "ENSAgentResolver",
    );
    ensResolver = await ENSAgentResolver.deploy();
    await ensResolver.waitForDeployment();

    // Deploy wardex
    const wardex = await ethers.getContractFactory("wardex");
    wardex = await wardex.deploy(await ensResolver.getAddress());
    await wardex.waitForDeployment();
  });

  describe("Contract Deployment", function () {
    it("Should revert with zero address for wardex", async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      try {
        await CoinbaseSmartWalletAgent.deploy(
          ethers.ZeroAddress,
          owner.address,
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("ZeroAddress");
      }
    });

    it("Should revert with zero address for factory", async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      try {
        await CoinbaseSmartWalletAgent.deploy(
          await wardex.getAddress(),
          ethers.ZeroAddress,
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("ZeroAddress");
      }
    });

    it("Should deploy with valid addresses", async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      walletAgent = await CoinbaseSmartWalletAgent.deploy(
        await wardex.getAddress(),
        owner.address, // Using owner as mock factory
      );
      await walletAgent.waitForDeployment();

      expect(await walletAgent.wardex()).to.equal(
        await wardex.getAddress(),
      );
      expect(await walletAgent.walletFactory()).to.equal(owner.address);
    });
  });

  describe("Protocol Stats", function () {
    beforeEach(async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      walletAgent = await CoinbaseSmartWalletAgent.deploy(
        await wardex.getAddress(),
        owner.address,
      );
      await walletAgent.waitForDeployment();
    });

    it("Should return zero stats initially", async function () {
      const [totalWallets, totalExecutions] =
        await walletAgent.getProtocolStats();
      expect(totalWallets).to.equal(0n);
      expect(totalExecutions).to.equal(0n);
    });

    it("Should report zero total wallets", async function () {
      const totalWallets = await walletAgent.totalWallets();
      expect(totalWallets).to.equal(0n);
    });

    it("Should report zero total executions", async function () {
      const totalExecs = await walletAgent.totalExecutions();
      expect(totalExecs).to.equal(0n);
    });
  });

  describe("wardex Integration", function () {
    it("Should reference the correct wardex contract", async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      walletAgent = await CoinbaseSmartWalletAgent.deploy(
        await wardex.getAddress(),
        owner.address,
      );
      await walletAgent.waitForDeployment();

      const wardexAddr = await walletAgent.wardex();
      expect(wardexAddr).to.equal(await wardex.getAddress());
    });

    it("Should reference the correct factory", async function () {
      const CoinbaseSmartWalletAgent = await ethers.getContractFactory(
        "CoinbaseSmartWalletAgent",
      );
      walletAgent = await CoinbaseSmartWalletAgent.deploy(
        await wardex.getAddress(),
        owner.address,
      );
      await walletAgent.waitForDeployment();

      const factoryAddr = await walletAgent.walletFactory();
      expect(factoryAddr).to.equal(owner.address);
    });
  });

  describe("ENS + wardex + Smart Wallet Flow", function () {
    it("Should complete the full ENS -> wardex -> verification flow", async function () {
      // Step 1: Set ENS permissions
      await ensResolver.syncPermissions(
        owner.address,
        ethers.parseEther("10"), // maxSpend
        ethers.parseEther("100"), // dailyLimit
        50, // slippageBps (0.5%)
        [], // tokens
        [], // protocols
        Math.floor(Date.now() / 1000) + 86400, // expiry (24h)
        true, // active
      );

      // Step 2: Verify permissions are set
      const perms = await ensResolver.getPermissions(owner.address);
      expect(perms.active).to.be.true;
      expect(perms.maxSpend).to.equal(ethers.parseEther("10"));

      // Step 3: Propose through wardex
      const tx = await wardex.propose(
        agent.address,
        owner.address,
        "0xdeadbeef",
      );
      const receipt = await tx.wait();

      // Extract proposal ID from event
      const event = receipt.logs.find((log) => {
        try {
          return wardex.interface.parseLog(log)?.name === "ActionProposed";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      const parsedLog = wardex.interface.parseLog(event);
      const proposalId = parsedLog.args.proposalId;

      // Step 4: Verify through wardex (checks ENS permissions)
      await wardex.verify(proposalId);

      // Step 5: Confirm verification
      const isVerified = await wardex.isVerified(proposalId);
      expect(isVerified).to.be.true;

      // Step 6: Execute
      await wardex.execute(proposalId);

      // Step 7: Confirm execution
      const proposal = await wardex.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });
  });
});
