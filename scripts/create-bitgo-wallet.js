/**
 * create-bitgo-wallet.js
 *
 * Generates a new BitGo test wallet for use with DarkAgent.
 *
 * Usage:
 *   node scripts/create-bitgo-wallet.js
 *
 * Prerequisites:
 *   npm install bitgo
 *   Set BITGO_ACCESS_TOKEN (and optionally BITGO_ENTERPRISE_ID) in your .env
 */

require('dotenv').config();
const { BitGo } = require('bitgo');

async function main() {
  const accessToken = process.env.BITGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('BITGO_ACCESS_TOKEN is not set in your .env file');
  }

  const bitgo = new BitGo({ env: 'test', accessToken });

  const walletParams = {
    label: 'DarkAgent Test Wallet',
    passphrase: 'darkagent123',
  };

  if (process.env.BITGO_ENTERPRISE_ID) {
    walletParams.enterprise = process.env.BITGO_ENTERPRISE_ID;
  }

  console.log('Creating wallet on BitGo test environment...');

  const result = await bitgo
    .coin('tbase')
    .wallets()
    .generateWallet(walletParams);

  const walletId = result.wallet.id();

  console.log('\n✅ Wallet created successfully!');
  console.log('Wallet ID :', walletId);
  console.log('Passphrase :', 'darkagent123');
  console.log('\nAdd the following to your .env file:');
  console.log(`BITGO_WALLET_ID=${walletId}`);
  console.log('BITGO_PASSPHRASE=darkagent123');
  console.log('BITGO_ENV=test');
}

main().catch((err) => {
  console.error('Error creating wallet:', err.message);
  process.exit(1);
});
