---
eip: "TODO"
title: Agent Permission Records for ENS
author: DarkAgent Team
status: Draft
type: Standards Track
category: ENS
created: 2026-03-13
---

## Abstract

This standard defines a new namespace within ENS Text Records (`agent.*`) to store machine-readable, on-chain permissions and guardrails for autonomous AI agents. This allows users to configure the financial constraints of their agents securely through the public ENS infrastructure, rather than relying on disparate, fragmented proprietary policy engines.

## Motivation

Agents currently act as EOA signers without an inherent standard for defining *how* they are allowed to operate on behalf of a human user. 

While ENS successfully stores social text records (e.g. `avatar`, `twitter`), it is vastly under-utilized as a decentralized financial configuration layer. By establishing the `agent.*` prefix, any DApp, smart contract architecture (like DarkAgent), or institutional wallet adapter (like BitGo) can automatically index a user's defined AI compliance rules globally.

## Specification

We propose standardizing the following text record keys to outline execution limits. These values MUST be deterministically readable by a cross-chain resolver smart contract.

| Key | Example Value | Description |
|---|---|---|
| `agent.max_spend` | `"100"` | Max spending limit per execution (in base native unit, e.g., ETH). |
| `agent.daily_limit` | `"86400"` | Reset timeframe in seconds. |
| `agent.slippage` | `"50"` | Max slippage tolerated in basis points (e.g., 50 = 0.5%). |
| `agent.tokens` | `"[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48]"` | Whitelist of executable token asset contract addresses. |
| `agent.protocols` | `"[0x1111111254fb6c44bac0bed2854e76f90643097d]"` | Whitelist of allowed DeFi routing protocol addresses. |
| `agent.expiry` | `"1710352512"` | Unix timestamp mapping the hardcut end of an agent's lifecycle. |
| `agent.active` | `"true"` | Global unpaused boolean. Set `"false"` as a master circuit breaker. |

## Smart Contract Integration (`ENSAgentResolver.sol`)

By establishing this standard, a single global resolver contract `ENSAgentResolver` can be deployed on networks like Base. The resolver intercepts the arbitrary text records via off-chain read (or cross-chain ENS reading solutions) and safely enforces the boolean checks for `Base` deployed agents without gas-intensive mappings.

## Compatibility

This expands upon ENSIP-5 by formally introducing a recognized `agent.` key prefix structure, specifically targeted at De-Fi composability. No changes to the core `PublicResolver` are necessary. 

## References

1. DarkAgent Core Protocol (Base) 
2. BitGo Agent Policy Adapter Integration