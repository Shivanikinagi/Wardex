# 🚀 Render Deployment Fix Guide

## 🔴 The Error You're Seeing

```
TypeError: Cannot destructure property 'arrayify' of 'utils' as it is undefined.
```

This happens because:
1. Render cached old node_modules with ethers v5
2. Your code uses ethers v6 syntax
3. The cache needs to be cleared

## ✅ Quick Fix Steps

### Option 1: Clear Build Cache (Recommended)

1. Go to your Render dashboard
2. Select your service
3. Go to **Settings** → **Build & Deploy**
4. Click **Clear build cache**
5. Click **Manual Deploy** → **Deploy latest commit**

### Option 2: Force Fresh Install

Add this to your Render environment variables:
```
NPM_CONFIG_CACHE=/tmp/npm-cache
```

Then redeploy.

### Option 3: Update Render Configuration

I've created `render.yaml` with proper Node.js version pinning:

```yaml
services:
  - type: web
    name: wardex-backend
    env: node
    region: oregon
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 18.20.0
```

**To use this:**
1. Commit the changes:
   ```bash
   git add package.json render.yaml
   git commit -m "Fix Render deployment with proper Node version"
   git push
   ```

2. In Render dashboard:
   - Go to your service
   - Settings → Build & Deploy
   - Set **Build Command**: `npm install`
   - Set **Start Command**: `npm start`
   - Clear build cache
   - Redeploy

## 🔧 Manual Render Setup (If Starting Fresh)

### 1. Create New Web Service

1. Go to https://dashboard.render.com/
2. Click **New** → **Web Service**
3. Connect your Git repository

### 2. Configure Service

**Basic Settings:**
- Name: `wardex-backend`
- Region: Choose closest to you
- Branch: `main` (or your default branch)
- Root Directory: `wardex` (if repo root) or leave blank
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

**Advanced Settings:**
- Node Version: `18.20.0`
- Auto-Deploy: `Yes`

### 3. Add Environment Variables

Click **Environment** tab and add all these from your `.env`:

**Required:**
```
NODE_ENV=production
PRIVATE_KEY=your_private_key_without_0x
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_key
DEPLOYER_ADDRESS=your_wallet_address
```

**API Keys:**
```
VENICE_API_KEY=your_venice_key
VENICE_MODEL=llama-3.3-70b
VENICE_COST_USDC=0.001
```

**Contracts (after deployment):**
```
wardex_CONTRACT=0x...
VERIFIER_CONTRACT=0x...
AGENT_TREASURY_CONTRACT=0x...
WSTETH_CONTRACT=0x...
```

**Filecoin:**
```
FILECOIN_UPLOAD_ENDPOINT=your_endpoint
FILECOIN_API_KEY=your_key
WEB3_STORAGE_TOKEN=your_token
```

**Optional Integrations:**
```
LIT_POLICY_API_URL=your_lit_url
LIT_ACTION_CID=your_cid
ZYFAI_API_KEY=your_zyfai_key
```

**x402 Payment:**
```
X402_AMOUNT=0.001
X402_CURRENCY=USDC
X402_NETWORK=base-sepolia
```

### 4. Deploy

Click **Create Web Service** and wait for deployment.

## 🧪 Verify Deployment

Once deployed, test your endpoints:

```bash
# Health check
curl https://your-app.onrender.com/

# Test Blink analysis
curl -X POST https://your-app.onrender.com/analyze-blink \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/blink"}'
```

## 🐛 Troubleshooting

### Still Getting ethers Error?

1. **Check Node version in logs:**
   ```
   Render Dashboard → Logs → Look for "Node version"
   ```
   Should be 18.x or higher.

2. **Force clean install:**
   Add to environment variables:
   ```
   NPM_CONFIG_CACHE=/tmp/npm-cache
   NODE_MODULES_CACHE=false
   ```

3. **Check package-lock.json:**
   ```bash
   # Locally
   rm -rf node_modules package-lock.json
   npm install
   git add package-lock.json
   git commit -m "Regenerate package-lock with ethers v6"
   git push
   ```

### Deployment Fails

- Check logs in Render dashboard
- Verify all required environment variables are set
- Ensure `PRIVATE_KEY` doesn't have `0x` prefix
- Check that RPC URLs are accessible

### Server Starts But Crashes

- Check environment variables are correct
- Verify contract addresses are valid
- Test API keys locally first
- Check Render logs for specific errors

## 📊 Monitor Your Service

**Render Dashboard:**
- Logs: Real-time server logs
- Metrics: CPU, memory, bandwidth usage
- Events: Deployment history

**Set Up Alerts:**
1. Settings → Notifications
2. Add email for deployment failures
3. Add webhook for monitoring

## 💰 Cost Optimization

**Free Tier Limits:**
- 750 hours/month
- Spins down after 15 min inactivity
- Slower cold starts

**To Prevent Spin Down:**
- Upgrade to paid plan ($7/month)
- Or use a cron job to ping every 10 minutes:
  ```bash
  # Use cron-job.org or similar
  */10 * * * * curl https://your-app.onrender.com/
  ```

## 🔄 Update Deployment

**Automatic (recommended):**
- Just push to your Git branch
- Render auto-deploys

**Manual:**
- Render Dashboard → Manual Deploy → Deploy latest commit

## 🎯 Next Steps After Deployment

1. ✅ Get your Render URL (e.g., `https://wardex-backend.onrender.com`)
2. ✅ Update frontend `.env`:
   ```
   VITE_wardex_API_URL=https://wardex-backend.onrender.com
   ```
3. ✅ Redeploy frontend to Vercel
4. ✅ Test end-to-end flow

## 📚 Useful Links

- Render Docs: https://render.com/docs
- Node.js on Render: https://render.com/docs/node-version
- Environment Variables: https://render.com/docs/environment-variables
- Troubleshooting: https://render.com/docs/troubleshooting-deploys

---

**Need more help?** Check the Render logs first - they usually show the exact issue.
