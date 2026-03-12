const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DarkAgent", function () {
    let darkAgent, capabilityCheck, verifier, slippageGuard, signatureVerifier;
    let owner, agent1, agent2, attacker;

    beforeEach(async function () {
        [owner, agent1, agent2, attacker] = await ethers.getSigners();

        // Deploy DarkAgent
        const DarkAgent = await ethers.getContractFactory("DarkAgent");
        darkAgent = await DarkAgent.deploy();
        await darkAgent.waitForDeployment();

        // Deploy CapabilityCheck
        const CapabilityCheck = await ethers.getContractFactory("CapabilityCheck");
        capabilityCheck = await CapabilityCheck.deploy(await darkAgent.getAddress());
        await capabilityCheck.waitForDeployment();

        // Deploy Verifier
        const Verifier = await ethers.getContractFactory("Verifier");
        verifier = await Verifier.deploy(await darkAgent.getAddress());
        await verifier.waitForDeployment();

        // Deploy SlippageGuard
        const SlippageGuard = await ethers.getContractFactory("SlippageGuard");
        slippageGuard = await SlippageGuard.deploy(await darkAgent.getAddress());
        await slippageGuard.waitForDeployment();

        // Deploy SignatureVerifier
        const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier");
        signatureVerifier = await SignatureVerifier.deploy(await darkAgent.getAddress());
        await signatureVerifier.waitForDeployment();
    });

    describe("Agent Registration", function () {
        it("should register an agent with ENS name and capabilities", async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming", "token-swap", "payment"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );

            const agent = await darkAgent.getAgent(agent1.address);
            expect(agent.owner).to.equal(owner.address);
            expect(agent.ensName).to.equal("trading-agent.darkagent.eth");
            expect(agent.capabilities).to.deep.equal(["yield-farming", "token-swap", "payment"]);
            expect(agent.reputationScore).to.equal(50);
            expect(agent.status).to.equal(1); // Active
        });

        it("should not register the same agent twice", async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );

            await expect(
                darkAgent.registerAgent(
                    agent1.address,
                    "another-agent.darkagent.eth",
                    ["data-analysis"],
                    ethers.parseEther("0.01"),
                    ethers.parseEther("0.1"),
                    ethers.parseEther("0.05")
                )
            ).to.be.revertedWithCustomError(darkAgent, "AlreadyRegistered");
        });

        it("should emit AgentRegistered event", async function () {
            await expect(
                darkAgent.registerAgent(
                    agent1.address,
                    "trading-agent.darkagent.eth",
                    ["yield-farming"],
                    ethers.parseEther("0.01"),
                    ethers.parseEther("0.1"),
                    ethers.parseEther("0.05")
                )
            ).to.emit(darkAgent, "AgentRegistered");
        });
    });

    describe("Capability Enforcement", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming", "token-swap"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should allow actions within capabilities", async function () {
            const allowed = await darkAgent.checkCapability(agent1.address, "yield-farming");
            expect(allowed).to.be.true;
        });

        it("should block actions outside capabilities", async function () {
            const allowed = await darkAgent.checkCapability(agent1.address, "bridge-transfer");
            expect(allowed).to.be.false;
        });

        it("should revert on capability violation with executeWithCapabilityCheck", async function () {
            await expect(
                darkAgent.executeWithCapabilityCheck(agent1.address, "bridge-transfer")
            ).to.be.revertedWithCustomError(darkAgent, "CapabilityViolationError");
        });
    });

    describe("TEE Attestation", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should update attestation", async function () {
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("test-attestation"));

            await darkAgent.updateAttestation(agent1.address, attestationHash);

            const agent = await darkAgent.getAgent(agent1.address);
            expect(agent.attestationHash).to.equal(attestationHash);
        });

        it("should verify valid attestation", async function () {
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("test-attestation"));
            await darkAgent.updateAttestation(agent1.address, attestationHash);

            const valid = await darkAgent.verifyAttestation(agent1.address, attestationHash);
            expect(valid).to.be.true;
        });

        it("should reject invalid attestation", async function () {
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes("test-attestation"));
            const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("wrong-attestation"));
            await darkAgent.updateAttestation(agent1.address, attestationHash);

            const valid = await darkAgent.verifyAttestation(agent1.address, wrongHash);
            expect(valid).to.be.false;
        });
    });

    describe("Circuit Breaker", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should freeze agent wallet on circuit breaker fire", async function () {
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"));

            await darkAgent.fireCircuitBreaker(
                agent1.address,
                "TEE attestation mismatch",
                invalidHash
            );

            const agent = await darkAgent.getAgent(agent1.address);
            expect(agent.status).to.equal(2); // Frozen

            const statusStr = await darkAgent.getAgentStatusString(agent1.address);
            expect(statusStr).to.equal("FROZEN");
        });

        it("should emit CircuitBreakerFired and WalletFrozen events", async function () {
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"));

            await expect(
                darkAgent.fireCircuitBreaker(agent1.address, "Code tampered", invalidHash)
            )
                .to.emit(darkAgent, "CircuitBreakerFired")
                .and.to.emit(darkAgent, "WalletFrozen");
        });

        it("should block transactions after freeze", async function () {
            // Register agent2 as recipient
            await darkAgent.registerAgent(
                agent2.address,
                "data-agent.darkagent.eth",
                ["data-analysis"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );

            // Freeze agent1
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"));
            await darkAgent.fireCircuitBreaker(agent1.address, "Tampered", invalidHash);

            // Try to process transaction - should fail
            await expect(
                darkAgent.processTransaction(
                    agent1.address,
                    ethers.parseEther("0.001"),
                    agent2.address
                )
            ).to.be.revertedWithCustomError(darkAgent, "AgentNotActive");
        });

        it("should unfreeze agent after security review", async function () {
            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"));
            await darkAgent.fireCircuitBreaker(agent1.address, "Tampered", invalidHash);

            const newAttestation = ethers.keccak256(ethers.toUtf8Bytes("new-valid-attestation"));
            await darkAgent.unfreezeAgent(agent1.address, newAttestation);

            const agent = await darkAgent.getAgent(agent1.address);
            expect(agent.status).to.equal(1); // Active again
        });

        it("should penalize reputation on circuit breaker fire", async function () {
            const agentBefore = await darkAgent.getAgent(agent1.address);
            expect(agentBefore.reputationScore).to.equal(50);

            const invalidHash = ethers.keccak256(ethers.toUtf8Bytes("TAMPERED"));
            await darkAgent.fireCircuitBreaker(agent1.address, "Tampered", invalidHash);

            const agentAfter = await darkAgent.getAgent(agent1.address);
            expect(agentAfter.reputationScore).to.equal(30); // 50 - 20
        });
    });

    describe("Spending Controls", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["payment"],
                ethers.parseEther("0.01"),  // max per tx
                ethers.parseEther("0.1"),   // max per day
                ethers.parseEther("0.05")   // alert threshold
            );

            await darkAgent.registerAgent(
                agent2.address,
                "data-agent.darkagent.eth",
                ["data-analysis"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should approve transaction within limits", async function () {
            await darkAgent.processTransaction(
                agent1.address,
                ethers.parseEther("0.005"),
                agent2.address
            );

            const info = await darkAgent.getSpendingInfo(agent1.address);
            expect(info.dailySpent).to.equal(ethers.parseEther("0.005"));
        });

        it("should reject transaction exceeding per-tx limit", async function () {
            await expect(
                darkAgent.processTransaction(
                    agent1.address,
                    ethers.parseEther("0.02"), // exceeds 0.01 max
                    agent2.address
                )
            ).to.be.revertedWithCustomError(darkAgent, "ExceedsPerTxLimit");
        });

        it("should reject transaction to unverified recipient", async function () {
            await expect(
                darkAgent.processTransaction(
                    agent1.address,
                    ethers.parseEther("0.005"),
                    attacker.address // not a verified agent
                )
            ).to.be.revertedWithCustomError(darkAgent, "RecipientNotVerified");
        });
    });

    describe("ZK Compliance", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should post compliance proof", async function () {
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("compliance-proof-1"));

            await darkAgent.postComplianceProof(
                agent1.address,
                proofHash,
                "spending_limit",
                true
            );

            const [compliant, totalProofs] = await darkAgent.queryCompliance(agent1.address);
            expect(compliant).to.be.true;
            expect(totalProofs).to.equal(1);
        });

        it("should return non-compliant if proof failed", async function () {
            const proofHash = ethers.keccak256(ethers.toUtf8Bytes("failed-proof"));

            await darkAgent.postComplianceProof(
                agent1.address,
                proofHash,
                "spending_limit",
                false // verification failed
            );

            const [compliant] = await darkAgent.queryCompliance(agent1.address);
            expect(compliant).to.be.false;
        });
    });

    describe("Verifier Contract", function () {
        it("should verify spending limit proof", async function () {
            const proofData = ethers.toUtf8Bytes("spending-proof-data");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "spending_limit",
                [5, 10] // spent 5, limit 10 - should pass
            );

            expect(result).to.be.true;
        });

        it("should fail spending limit proof when over limit", async function () {
            const proofData = ethers.toUtf8Bytes("spending-proof-data");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "spending_limit",
                [15, 10] // spent 15, limit 10 - should fail
            );

            expect(result).to.be.false;
        });

        it("should verify sanctions proof", async function () {
            const proofData = ethers.toUtf8Bytes("sanctions-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "sanctions",
                [0, 0] // 0 = no sanctions match
            );

            expect(result).to.be.true;
        });

        it("should query compliance status", async function () {
            // Submit a valid proof first
            await verifier.submitAndVerifyProof(
                agent1.address,
                ethers.toUtf8Bytes("proof-1"),
                "spending_limit",
                [5, 10]
            );

            const status = await verifier.getComplianceStatus(agent1.address);
            expect(status.isCompliant).to.be.true;
            expect(status.totalProofs).to.equal(1);
        });
    });

    describe("CapabilityCheck Contract", function () {
        it("should grant and verify capabilities", async function () {
            await capabilityCheck.grantCapabilities(
                agent1.address,
                ["yield-farming", "token-swap"]
            );

            expect(await capabilityCheck.hasCapability(agent1.address, "yield-farming")).to.be.true;
            expect(await capabilityCheck.hasCapability(agent1.address, "bridge-transfer")).to.be.false;
        });

        it("should check capability and return result", async function () {
            await capabilityCheck.grantCapabilities(agent1.address, ["yield-farming"]);

            const result = await capabilityCheck.check.staticCall(agent1.address, "yield-farming");
            expect(result).to.be.true;
        });

        it("should detect capability violation", async function () {
            await capabilityCheck.grantCapabilities(agent1.address, ["yield-farming"]);

            const result = await capabilityCheck.check.staticCall(agent1.address, "bridge-transfer");
            expect(result).to.be.false;
        });

        it("should enforce capability and revert on violation", async function () {
            await capabilityCheck.grantCapabilities(agent1.address, ["yield-farming"]);

            await expect(
                capabilityCheck.enforce(agent1.address, "bridge-transfer")
            ).to.be.revertedWithCustomError(capabilityCheck, "ActionNotAllowed");
        });
    });

    describe("SlippageGuard Contract", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["token-swap"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should register a swap with slippage guard", async function () {
            const tx = await slippageGuard.registerSwap(
                agent1.address,
                ethers.ZeroAddress, // ETH
                agent2.address,     // token out placeholder
                ethers.parseEther("1"),
                ethers.parseEther("2500"), // expected output
                50 // 0.5% slippage
            );
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);

            const stats = await slippageGuard.getStats();
            expect(stats[0]).to.equal(1); // totalSwaps
        });

        it("should configure agent slippage", async function () {
            await slippageGuard.configureAgentSlippage(agent1.address, 50); // 0.5%

            const config = await slippageGuard.getAgentConfig(agent1.address);
            expect(config.defaultSlippageBps).to.equal(50);
            expect(config.customConfigSet).to.be.true;
        });

        it("should reject slippage above maximum (10%)", async function () {
            await expect(
                slippageGuard.configureAgentSlippage(agent1.address, 1500) // 15% > 10% max
            ).to.be.revertedWithCustomError(slippageGuard, "InvalidSlippage");
        });

        it("should settle swap as passed when within slippage", async function () {
            await slippageGuard.configureAgentSlippage(agent1.address, 50);

            const tx = await slippageGuard.registerSwap(
                agent1.address,
                ethers.ZeroAddress,
                agent2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2500"),
                50
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(l => l.fragment?.name === 'SwapGuarded');
            const swapId = event.args[0];

            // Settle with actual output within tolerance (0.4% slip)
            const result = await slippageGuard.settleSwap.staticCall(swapId, ethers.parseEther("2490"));
            expect(result).to.be.true;
        });

        it("should settle swap as failed when slippage exceeded", async function () {
            await slippageGuard.configureAgentSlippage(agent1.address, 50);

            const tx = await slippageGuard.registerSwap(
                agent1.address,
                ethers.ZeroAddress,
                agent2.address,
                ethers.parseEther("1"),
                ethers.parseEther("2500"),
                50
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(l => l.fragment?.name === 'SwapGuarded');
            const swapId = event.args[0];

            // Settle with actual output way below tolerance (5% slip)
            const result = await slippageGuard.settleSwap.staticCall(swapId, ethers.parseEther("2375"));
            expect(result).to.be.false;
        });

        it("should revert on inline validation when slippage exceeded", async function () {
            await slippageGuard.configureAgentSlippage(agent1.address, 50);

            await expect(
                slippageGuard.validateSlippage(
                    agent1.address,
                    ethers.parseEther("2500"), // expected
                    ethers.parseEther("2400"), // actual (4% slip)
                    50 // max 0.5%
                )
            ).to.be.revertedWithCustomError(slippageGuard, "SlippageExceeded");
        });

        it("should pass inline validation within tolerance", async function () {
            // This should not revert
            await slippageGuard.validateSlippage(
                agent1.address,
                ethers.parseEther("2500"), // expected
                ethers.parseEther("2490"), // actual (0.4% slip)
                50 // max 0.5%
            );
        });
    });

    describe("SignatureVerifier Contract", function () {
        beforeEach(async function () {
            await darkAgent.registerAgent(
                agent1.address,
                "trading-agent.darkagent.eth",
                ["yield-farming"],
                ethers.parseEther("0.01"),
                ethers.parseEther("0.1"),
                ethers.parseEther("0.05")
            );
        });

        it("should verify a valid EIP-712 authorization signature", async function () {
            const action = "yield-farming";
            const nonce = 1;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Build EIP-712 typed data
            const sigVerifierAddr = await signatureVerifier.getAddress();
            const network = await ethers.provider.getNetwork();
            const chainId = Number(network.chainId);

            const domain = {
                name: "DarkAgent",
                version: "1",
                chainId: chainId,
                verifyingContract: sigVerifierAddr,
            };

            const types = {
                Authorization: [
                    { name: "agent", type: "address" },
                    { name: "action", type: "string" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const value = {
                agent: agent1.address,
                action: action,
                nonce: nonce,
                deadline: deadline,
            };

            // Owner signs the authorization
            const signature = await owner.signTypedData(domain, types, value);

            // Verify on-chain
            const result = await signatureVerifier.verifyAuthorization.staticCall(
                agent1.address,
                action,
                nonce,
                deadline,
                signature
            );
            expect(result).to.be.true;
        });

        it("should reject signature from non-owner", async function () {
            const action = "yield-farming";
            const nonce = 1;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const sigVerifierAddr = await signatureVerifier.getAddress();
            const network = await ethers.provider.getNetwork();
            const chainId = Number(network.chainId);

            const domain = {
                name: "DarkAgent",
                version: "1",
                chainId: chainId,
                verifyingContract: sigVerifierAddr,
            };

            const types = {
                Authorization: [
                    { name: "agent", type: "address" },
                    { name: "action", type: "string" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const value = {
                agent: agent1.address,
                action: action,
                nonce: nonce,
                deadline: deadline,
            };

            // Attacker signs (not the owner)
            const signature = await attacker.signTypedData(domain, types, value);

            await expect(
                signatureVerifier.verifyAuthorization(
                    agent1.address,
                    action,
                    nonce,
                    deadline,
                    signature
                )
            ).to.be.revertedWithCustomError(signatureVerifier, "SignerNotOwner");
        });

        it("should reject expired signature", async function () {
            const action = "yield-farming";
            const nonce = 1;
            const deadline = 1; // Already expired (Unix timestamp 1)

            const sigVerifierAddr = await signatureVerifier.getAddress();
            const network = await ethers.provider.getNetwork();
            const chainId = Number(network.chainId);

            const domain = {
                name: "DarkAgent",
                version: "1",
                chainId: chainId,
                verifyingContract: sigVerifierAddr,
            };

            const types = {
                Authorization: [
                    { name: "agent", type: "address" },
                    { name: "action", type: "string" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const value = {
                agent: agent1.address,
                action: action,
                nonce: nonce,
                deadline: deadline,
            };

            const signature = await owner.signTypedData(domain, types, value);

            await expect(
                signatureVerifier.verifyAuthorization(
                    agent1.address,
                    action,
                    nonce,
                    deadline,
                    signature
                )
            ).to.be.revertedWithCustomError(signatureVerifier, "SignatureExpired");
        });

        it("should reject replay (same nonce)", async function () {
            const action = "yield-farming";
            const nonce = 1;
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const sigVerifierAddr = await signatureVerifier.getAddress();
            const network = await ethers.provider.getNetwork();
            const chainId = Number(network.chainId);

            const domain = {
                name: "DarkAgent",
                version: "1",
                chainId: chainId,
                verifyingContract: sigVerifierAddr,
            };

            const types = {
                Authorization: [
                    { name: "agent", type: "address" },
                    { name: "action", type: "string" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" },
                ],
            };

            const value = {
                agent: agent1.address,
                action: action,
                nonce: nonce,
                deadline: deadline,
            };

            const signature = await owner.signTypedData(domain, types, value);

            // First use succeeds
            await signatureVerifier.verifyAuthorization(
                agent1.address, action, nonce, deadline, signature
            );

            // Replay should fail
            await expect(
                signatureVerifier.verifyAuthorization(
                    agent1.address, action, nonce, deadline, signature
                )
            ).to.be.revertedWithCustomError(signatureVerifier, "NonceAlreadyUsed");
        });

        it("should track verification stats", async function () {
            const stats = await signatureVerifier.getStats();
            expect(stats[0]).to.equal(0); // totalVerified
            expect(stats[1]).to.equal(0); // totalFailed
        });
    });

    describe("Verifier — New Proof Types", function () {
        it("should verify ens_rule_compliance proof", async function () {
            const proofData = ethers.toUtf8Bytes("ens-rule-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "ens_rule_compliance",
                [1, 1] // rule hash non-zero + compliant
            );

            expect(result).to.be.true;
        });

        it("should fail ens_rule_compliance when not compliant", async function () {
            const proofData = ethers.toUtf8Bytes("ens-rule-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "ens_rule_compliance",
                [1, 0] // rule hash non-zero + NOT compliant
            );

            expect(result).to.be.false;
        });

        it("should verify slippage_check proof", async function () {
            const proofData = ethers.toUtf8Bytes("slippage-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "slippage_check",
                [30, 50] // actual 0.3% <= max 0.5%
            );

            expect(result).to.be.true;
        });

        it("should fail slippage_check when slippage exceeded", async function () {
            const proofData = ethers.toUtf8Bytes("slippage-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "slippage_check",
                [100, 50] // actual 1.0% > max 0.5%
            );

            expect(result).to.be.false;
        });

        it("should verify signature_auth proof", async function () {
            const proofData = ethers.toUtf8Bytes("sig-auth-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "signature_auth",
                [1, 0] // sig valid = 1
            );

            expect(result).to.be.true;
        });

        it("should fail signature_auth when invalid", async function () {
            const proofData = ethers.toUtf8Bytes("sig-auth-proof");

            const result = await verifier.submitAndVerifyProof.staticCall(
                agent1.address,
                proofData,
                "signature_auth",
                [0, 0] // sig valid = 0
            );

            expect(result).to.be.false;
        });
    });
});
