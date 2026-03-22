# 🔧 Filecoin Upload Fix Guide

## 🔴 Current Issues

1. **Filecoin FOC upload timed out** after 15000ms
2. **W3UP UCAN fetch failed** - missing configuration
3. **NFT.Storage API 401 error** - malformed or invalid API key
4. **No transactions visible** in Base Sepolia explorer

## ✅ Fix Filecoin Upload

### Option 1: Use Filecoin FOC (Recommended)

1. **Get Filecoin Calibration testnet tokens:**
   - Visit: https://faucet.calibration.fildev.network/
   - Enter your wallet address
   - Get test USDFC tokens

2. **Set up environment variables:**
   ```bash
   # In your .env file
   FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
   FILECOIN_PRIVATE_KEY=your_private_key_without_0x
   FILECOIN_WALLET_ADDRESS=your_wallet_address
   FILECOIN_FOC_ENABLED=true
   WARDEX_FILECOIN_UPLOAD_TIMEOUT_MS=30000
   WARDEX_FILECOIN_TOTAL_TIMEOUT_MS=90000
   FILECOIN_UPLOAD_RETRIES=3
   FILECOIN_RETRY_DELAY_MS=2000
   ```

3. **Run setup script:**
   ```bash
   cd darkagent
   npm run filecoin:foc:setup
   ```

### Option 2: Use Web3.Storage (W3UP)

1. **Get W3UP credentials:**
   - Visit: https://web3.storage/
   - Sign up with email
   - Create a space

2. **Set environment variables:**
   ```bash
   FILECOIN_W3UP_EMAIL=your_email@example.com
   FILECOIN_SPACE_DID=did:key:your_space_did
   FILECOIN_UCAN_ENABLED=true
   ```

### Option 3: Use NFT.Storage (Legacy)

1. **Get valid API key:**
   - Visit: https://nft.storage/
   - Sign in and create API key
   - Copy the key

2. **Set environment variable:**
   ```bash
   WEB3_STORAGE_TOKEN=your_valid_nft_storage_api_key
   ```

## 🔍 Fix No Transactions Visible

The contract shows no transactions because it was just deployed. To see transactions:

### 1. Interact with the Contract

Run a test transaction:

```bash
cd darkagent
npx hardhat run scripts/execute-demo.js --network base_sepolia
```

### 2. Verify Contract on Basescan

```bash
npx hardhat verify --network base_sepolia YOUR_CONTRACT_ADDRESS
```

### 3. Check the Correct Contract Address

Make sure you're looking at the right contract:
- Check `frontend/src/contracts/deployment.json`
- Verify the address matches what's in your `.env`

## 🧪 Test Filecoin Upload

```bash
cd darkagent

# Test FOC upload
npm run filecoin:foc:setup

# Check status
node -e "const f = require('./sdk/filecoin'); f.getStorageStatus().then(console.log)"
```

## 📝 Updated Environment Variables

Update your `.env` file:

```bash
# Filecoin Configuration (choose ONE method)

# Method 1: FOC (Recommended)
FILECOIN_FOC_ENABLED=true
FILECOIN_RPC_URL=https://api.calibration.node.glif.io/rpc/v1
FILECOIN_PRIVATE_KEY=your_key
FILECOIN_WALLET_ADDRESS=your_address
WARDEX_FILECOIN_UPLOAD_TIMEOUT_MS=30000
WARDEX_FILECOIN_TOTAL_TIMEOUT_MS=90000
FILECOIN_UPLOAD_RETRIES=3
FILECOIN_RETRY_DELAY_MS=2000

# Method 2: W3UP
FILECOIN_UCAN_ENABLED=true
FILECOIN_W3UP_EMAIL=your@email.com
FILECOIN_SPACE_DID=did:key:...

# Method 3: NFT.Storage (Legacy)
WEB3_STORAGE_TOKEN=your_valid_token

# Contract addresses
WARDEX_CONTRACT=0x03Aa853D64f1b17551191E7200D036c5e5ec8e4b
VERIFIER_CONTRACT=your_verifier_address
```

## 🚀 Deploy and Test Flow

1. **Update environment:**
   ```bash
   cd darkagent
   # Edit .env with correct values
   ```

2. **Test locally:**
   ```bash
   npm run blink:server
   # In another terminal:
   curl http://localhost:8787/
   ```

3. **Deploy to Render:**
   - Update environment variables in Render dashboard
   - Redeploy

4. **Test Filecoin upload:**
   - Make a test transaction
   - Check logs for successful upload
   - Verify CID appears in response

## 📊 Success Indicators

**Filecoin working:**
```
✓ Filecoin FOC upload successful
✓ PieceCID: bafkzcib...
✓ URL: https://calibration.filfox.info/en/message/...
```

**Transactions visible:**
```
✓ Contract verified on Basescan
✓ Transactions tab shows activity
✓ Events are logged
```

## 🐛 Troubleshooting

### Timeout Issues
- Increase `WARDEX_FILECOIN_UPLOAD_TIMEOUT_MS` to 30000 or 60000
- Increase `FILECOIN_UPLOAD_RETRIES` to 3 or 5
- Check network connectivity

### API Key Issues
- Verify API key is valid and not expired
- Check for extra spaces or quotes in .env
- Regenerate API key if needed

### No Transactions
- Contract might be newly deployed (no activity yet)
- Check you're on the correct network (Base Sepolia)
- Verify contract address is correct
- Run a test transaction to generate activity

## 🔗 Useful Links

- Filecoin Calibration Faucet: https://faucet.calibration.fildev.network/
- Web3.Storage: https://web3.storage/
- NFT.Storage: https://nft.storage/
- Base Sepolia Explorer: https://sepolia.basescan.org/
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

---

**Quick Fix:** Increase timeouts and retries, get valid API keys, and run test transactions to populate the explorer.
