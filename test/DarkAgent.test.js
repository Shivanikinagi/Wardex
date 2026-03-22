const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("wardex Protocol - End to End", function () {
  let wardex, ensResolver;
  let owner, agent1, user;

  beforeEach(async function () {
    [owner, agent1, user] = await ethers.getSigners();

    // 1. Deploy the ENS Agent Resolver
    const Resolver = await ethers.getContractFactory("ENSAgentResolver");
    ensResolver = await Resolver.deploy();

    // 2. Deploy wardex with Resolver address
    const wardex = await ethers.getContractFactory("wardex");
    wardex = await wardex.deploy(await ensResolver.getAddress());

    // 3. Mock up ENS records for the user
    const maxSpend = ethers.parseEther("100");
    const dailyLimit = 86400;
    const slippageBps = 50; // 0.5%
    await ensResolver.syncPermissions(
      user.address,
      maxSpend,
      dailyLimit,
      slippageBps,
      [], // allowedTokens
      [], // allowedProtocols
      0, // expiry
      true, // active
    );
  });

  describe("Verification Workflow", function () {
    it("should allow an agent to propose an action", async function () {
      const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");

      const tx = await wardex.propose(agent1.address, user.address, action);
      const receipt = await tx.wait();

      const proposalEvent = receipt.logs.find(
        (l) => l.fragment?.name === "ActionProposed",
      );
      expect(proposalEvent).to.not.be.undefined;

      const proposalId = proposalEvent.args[0];
      const proposal = await wardex.getProposal(proposalId);
      expect(proposal.agent).to.equal(agent1.address);
      expect(proposal.user).to.equal(user.address);
      expect(proposal.verified).to.be.false;
    });

    it("should dynamically verify a proposal via ENS Rules", async function () {
      const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
      const tx = await wardex.propose(agent1.address, user.address, action);
      const receipt = await tx.wait();
      const proposalEvent = receipt.logs.find(
        (l) => l.fragment?.name === "ActionProposed",
      );
      const proposalId = proposalEvent.args[0];

      await wardex.verify(proposalId);

      const isVerified = await wardex.isVerified(proposalId);
      expect(isVerified).to.be.true;
    });

    it("should execute a verified proposal", async function () {
      const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
      const tx = await wardex.propose(agent1.address, user.address, action);
      const receipt = await tx.wait();
      const proposalEvent = receipt.logs.find(
        (l) => l.fragment?.name === "ActionProposed",
      );
      const proposalId = proposalEvent.args[0];

      await wardex.verify(proposalId);
      await wardex.execute(proposalId);

      const proposal = await wardex.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("should revert execution if not verified", async function () {
      const action = ethers.toUtf8Bytes("malicious activity");
      const tx = await wardex.propose(agent1.address, user.address, action);
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(
        (l) => l.fragment?.name === "ActionProposed",
      ).args[0];

      try {
        await wardex.execute(proposalId);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("NotVerifiedYet");
      }
    });

    it("should reject verification if ENS master switch is false", async function () {
      // Turn off the agent via ENS
      await ensResolver.syncPermissions(
        user.address,
        0,
        0,
        0,
        [],
        [],
        0,
        false, // <-- deactivated
      );

      const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
      const tx = await wardex.propose(agent1.address, user.address, action);
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(
        (l) => l.fragment?.name === "ActionProposed",
      ).args[0];

      try {
        await wardex.verify(proposalId);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("VerificationFailedReason");
      }
    });
  });
});
