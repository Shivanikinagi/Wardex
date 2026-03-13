---
title: Agent Permission Records (ENS Standard)
description: A standard for storing machine-readable smart agent permissions on ENS.
author: DarkAgent Team
status: Draft
type: Standards Track
category: ERC
---

# ENS: The Financial Identity Layer

## Problem
Right now, ENS is mostly used for naming formats (e.g., `alice.eth`). There is no standard for storing machine-readable preferences. Because of this, AI agents cannot read user preferences directly from ENS, forcing them to rely on centralized off-chain databases.

## Solution
We introduce **Agent Permission Records** via the `agent.permissions` ENS text record.

This schema turns ENS from a simple name router into a full-fledged **financial identity layer** tailored for the AI Agent era. Any AI agent (or verification protocol like DarkAgent) reads this ENS record *before* executing any transaction.

## Specification

The `agent.permissions` text record MUST contain a valid JSON object adhering to the following schema:

```json
{
  "max_spend": "100",           // Decimal string matching base asset (e.g., 100 ETH or 100 USDC based on context)
  "slippage": 0.5,              // Float, maximum slippage tolerance percentage
  "allowed_protocols": [        // Array of protocol identifiers or canonical contract addresses
    "uniswap", 
    "aave"
  ],
  "allowed_tokens": [           // Token ticker symbols or addresses
    "ETH", 
    "USDC"
  ],
  "time_window": 86400,         // Integer, validity period of spend limit in seconds (e.g., 86400 = 24 hrs)
  "mev_protection": true        // Boolean, enforcing private RPC routing
}
```

## Protocol Integration
When a user instructs an AI agent to execute a transaction:
1. The agent's security layer (e.g., DarkAgent) resolves the user's ENS name.
2. It fetches the `agent.permissions` text record.
3. The on-chain Verification Protocol mathematically checks the proposed transaction against this JSON schema.
4. Execution is **blocked natively** if it violates the parameters.

## Impact for ENS
You give ENS a new use case. ENS becomes the decentralized, user-owned configuration file that rules all AI agents across the DeFi ecosystem.
