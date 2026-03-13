const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DarkAgent Protocol", function () {
    let darkAgent, owner, agent1, user;

    beforeEach(async function () {
        [owner, agent1, user] = await ethers.getSigners();

        const DarkAgent = await ethers.getContractFactory("DarkAgent");
        darkAgent = await DarkAgent.deploy();
    });

    describe("Verification Workflow", function () {
        it("should allow an agent to propose an action", async function () {
            const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
            
            const tx = await darkAgent.propose(agent1.address, user.address, action);
            const receipt = await tx.wait();
            
            const proposalEvent = receipt.logs.find(l => l.fragment?.name === 'ActionProposed');
            expect(proposalEvent).to.not.be.undefined;
            
            const proposalId = proposalEvent.args[0];
            const proposal = await darkAgent.getProposal(proposalId);
            expect(proposal.agent).to.equal(agent1.address);
            expect(proposal.user).to.equal(user.address);
            expect(proposal.verified).to.be.false;
        });

        it("should verify a proposal", async function () {
            const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
            const tx = await darkAgent.propose(agent1.address, user.address, action);
            const receipt = await tx.wait();
            const proposalEvent = receipt.logs.find(l => l.fragment?.name === 'ActionProposed');
            const proposalId = proposalEvent.args[0];

            await darkAgent.verify(proposalId);
            
            const isVerified = await darkAgent.isVerified(proposalId);
            expect(isVerified).to.be.true;
        });

        it("should execute a verified proposal", async function () {
            const action = ethers.toUtf8Bytes("swap 1 ETH to USDC");
            const tx = await darkAgent.propose(agent1.address, user.address, action);
            const receipt = await tx.wait();
            const proposalEvent = receipt.logs.find(l => l.fragment?.name === 'ActionProposed');
            const proposalId = proposalEvent.args[0];

            await darkAgent.verify(proposalId);
            await darkAgent.execute(proposalId);

            const proposal = await darkAgent.getProposal(proposalId);
            expect(proposal.executed).to.be.true;
        });

        it("should revert execution if not verified", async function () {
            const action = ethers.toUtf8Bytes("malicious activity");
            const tx = await darkAgent.propose(agent1.address, user.address, action);
            const receipt = await tx.wait();
            const proposalId = receipt.logs.find(l => l.fragment?.name === 'ActionProposed').args[0];

            await expect(darkAgent.execute(proposalId))
                .to.be.revertedWithCustomError(darkAgent, "NotVerifiedYet");
        });
    });
});
