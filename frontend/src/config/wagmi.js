/**
 * Wagmi + Coinbase Smart Wallet Configuration
 *
 * This configures the wagmi client with Coinbase Smart Wallet as the primary
 * wallet connector, enabling passkey-based authentication and ERC-4337
 * smart wallet functionality on Base Sepolia.
 */

import { http, createConfig } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Coinbase Smart Wallet Factory address on Base Sepolia
export const SMART_WALLET_FACTORY =
  "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

// Base Sepolia chain configuration
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/**
 * Wagmi configuration with Coinbase Smart Wallet connector
 *
 * Key features:
 * - Coinbase Smart Wallet (ERC-4337) as primary connector
 * - Injected provider (MetaMask, etc.) as fallback
 * - Supports passkeys and EOA ownership
 * - Configured for Base Sepolia testnet
 * - Automatic smart wallet creation on first connection
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: "wardex Protocol",
      // preference: 'all' allows both EOA and smart wallet connections
      preference: "all",
      enableMobileWalletLink: true,
      reloadOnDisconnect: false,
    }),
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});

export default wagmiConfig;
