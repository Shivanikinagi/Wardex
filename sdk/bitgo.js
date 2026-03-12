/**
 * sdk/bitgo.js
 *
 * BitGo vault integration for DarkAgent.
 * Wraps the BitGo SDK to provide wallet management, spending policies,
 * and freeze/unfreeze capabilities tied to DarkAgent's circuit breaker.
 *
 * Requires: npm install bitgo
 * Environment variables:
 *   BITGO_ACCESS_TOKEN, BITGO_WALLET_ID, BITGO_PASSPHRASE, BITGO_ENV
 */

require('dotenv').config()
const { BitGo } = require('bitgo')

const COIN = process.env.BITGO_COIN || 'tbase'

function createBitGo() {
  const accessToken = process.env.BITGO_ACCESS_TOKEN
  if (!accessToken) throw new Error('BITGO_ACCESS_TOKEN not set in .env')
  return new BitGo({ env: process.env.BITGO_ENV || 'test', accessToken })
}

async function getWallet() {
  const bitgo = createBitGo()
  const walletId = process.env.BITGO_WALLET_ID
  if (!walletId) throw new Error('BITGO_WALLET_ID not set in .env')
  return bitgo.coin(COIN).wallets().get({ id: walletId })
}

// ── Wallet Info ─────────────────────────────────────────────

async function getBalance() {
  const wallet = await getWallet()
  return {
    balance: wallet.balance(),
    confirmedBalance: wallet.confirmedBalance(),
    spendableBalance: wallet.spendableBalance(),
    coin: COIN,
  }
}

async function getWalletInfo() {
  const wallet = await getWallet()
  return {
    id: wallet.id(),
    label: wallet.label(),
    coin: COIN,
    balance: wallet.balance(),
    receiveAddress: wallet.receiveAddress(),
    isFrozen: await isWalletFrozen(),
  }
}

// ── Spending Policies ───────────────────────────────────────

/**
 * Set a velocity limit (daily spending cap) on the wallet.
 * @param {number} limitAmountSatoshi - Max daily spend in satoshi/wei
 */
async function setDailySpendingLimit(limitAmountSatoshi) {
  const wallet = await getWallet()
  await wallet.updatePolicyRule({
    id: 'darkagent-daily-limit',
    type: 'velocityLimit',
    action: { type: 'deny' },
    condition: {
      amountString: String(limitAmountSatoshi),
      timeWindow: 86400, // 24 hours
      groupTags: [],
      excludeTags: [],
    },
  })
  console.log(`✅ Daily spending limit set: ${limitAmountSatoshi} (${COIN} smallest unit)`)
  return { success: true, limit: limitAmountSatoshi }
}

/**
 * Add a whitelist policy — only allow sends to approved addresses.
 * @param {string[]} addresses - Array of allowed destination addresses
 */
async function setWhitelist(addresses) {
  const wallet = await getWallet()
  await wallet.updatePolicyRule({
    id: 'darkagent-whitelist',
    type: 'allowanddeny',
    action: { type: 'deny' },
    condition: {
      add: addresses,
    },
  })
  console.log(`✅ Whitelist set: ${addresses.length} addresses allowed`)
  return { success: true, count: addresses.length }
}

// ── Freeze / Unfreeze (Circuit Breaker) ─────────────────────

/**
 * Freeze the wallet — blocks all outgoing transactions.
 * Called when DarkAgent circuit breaker fires.
 * @param {number} durationSeconds - Freeze duration (default: 24 hours)
 */
async function freezeWallet(durationSeconds = 86400) {
  const wallet = await getWallet()
  await wallet.freeze({ duration: durationSeconds })
  console.log(`❄️ Wallet FROZEN for ${durationSeconds}s`)
  return { success: true, frozen: true, duration: durationSeconds }
}

/**
 * Check if wallet is currently frozen.
 */
async function isWalletFrozen() {
  const wallet = await getWallet()
  const freeze = wallet.freeze()
  if (!freeze || !freeze.time) return false
  const frozenUntil = new Date(freeze.time).getTime() + (freeze.expires || 0) * 1000
  return Date.now() < frozenUntil
}

// ── Transactions ────────────────────────────────────────────

/**
 * Send a transaction from the vault.
 * @param {string} recipient - Destination address
 * @param {string} amountWei - Amount in smallest unit (wei for tbase)
 */
async function sendTransaction(recipient, amountWei) {
  const wallet = await getWallet()
  const passphrase = process.env.BITGO_PASSPHRASE
  if (!passphrase) throw new Error('BITGO_PASSPHRASE not set in .env')

  const result = await wallet.send({
    address: recipient,
    amount: String(amountWei),
    walletPassphrase: passphrase,
  })

  console.log(`✅ TX sent: ${result.txid}`)
  return {
    success: true,
    txid: result.txid,
    status: result.status,
  }
}

/**
 * Get recent transfers for audit trail.
 * @param {number} limit - Max number of transfers to return
 */
async function getTransfers(limit = 25) {
  const wallet = await getWallet()
  const transfers = await wallet.transfers({ limit })
  return transfers.transfers.map(t => ({
    id: t.id,
    txid: t.txid,
    type: t.type,
    value: t.value,
    state: t.state,
    date: t.date,
    entries: t.entries?.map(e => ({ address: e.address, value: e.value })),
  }))
}

module.exports = {
  getBalance,
  getWalletInfo,
  setDailySpendingLimit,
  setWhitelist,
  freezeWallet,
  isWalletFrozen,
  sendTransaction,
  getTransfers,
}
