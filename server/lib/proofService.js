const { randomUUID } = require("crypto");
const { Wallet, getBytes, keccak256, toUtf8Bytes, verifyMessage } = require("ethers");

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

class ProofService {
  constructor({ store, eventHub, signerPrivateKey = process.env.DARKAGENT_PROOF_SIGNER_PRIVATE_KEY }) {
    this.store = store;
    this.eventHub = eventHub;
    this.signer = signerPrivateKey
      ? new Wallet(signerPrivateKey)
      : Wallet.createRandom();
  }

  async createProof({
    kind,
    verdict,
    ensName,
    actionId,
    policy,
    evaluation,
    execution,
    watcher,
    reason,
    integrations,
  }) {
    const createdAt = new Date().toISOString();
    const policyHash = keccak256(toUtf8Bytes(stableSerialize(policy || {})));
    const evaluationHash = keccak256(
      toUtf8Bytes(stableSerialize(evaluation || {}))
    );
    const executionHash = keccak256(
      toUtf8Bytes(stableSerialize(execution || {}))
    );
    const receiptHash = keccak256(
      toUtf8Bytes(
        stableSerialize({
          actionId,
          createdAt,
          ensName,
          evaluationHash,
          executionHash,
          kind,
          policyHash,
          reason,
          verdict,
          watcherVersion: watcher?.version || 0,
        })
      )
    );

    const signature = await this.signer.signMessage(getBytes(receiptHash));
    const recoveredSigner = verifyMessage(getBytes(receiptHash), signature);

    const proof = {
      id: randomUUID(),
      kind,
      verdict,
      ensName,
      actionId,
      createdAt,
      receiptHash,
      signature,
      signerAddress: this.signer.address,
      recoveredSigner,
      verified: recoveredSigner.toLowerCase() === this.signer.address.toLowerCase(),
      policyHash,
      evaluationHash,
      executionHash,
      reason: reason || null,
      watcherVersion: watcher?.version || 0,
      stealthAddress: execution?.stealthAddress || null,
      executionMode: execution?.mode || null,
      integrations: {
        litActionCid:
          integrations?.litActionCid ??
          evaluation?.litActionCid ??
          null,
        litPolicySealed:
          integrations?.litPolicySealed ??
          evaluation?.litPolicySealed ??
          false,
        filecoinCid: integrations?.filecoinCid ?? null,
        fundedBy: integrations?.fundedBy ?? null,
        budgetSource:
          integrations?.budgetSource ??
          policy?.budgetSource ??
          null,
      },
    };

    this.store.append(proof);
    this.eventHub.publish("proof", {
      id: proof.id,
      verdict: proof.verdict,
      kind: proof.kind,
      ensName: proof.ensName,
      createdAt: proof.createdAt,
    });

    return proof;
  }

  getStatus() {
    return {
      signerAddress: this.signer.address,
    };
  }
}

module.exports = {
  ProofService,
};
