# DarkAgent Deployment Checklist ✅

## ✅ Build Status: PASSING
Your frontend builds successfully! The warnings are just optimization notices and don't affect functionality.

## 🚀 Vercel Deployment Steps

### 1. Push to Git (if not already done)
```bash
cd darkagent
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel

**Option A: Vercel CLI (Recommended)**
```bash
cd frontend
npm install -g vercel
vercel login
vercel
```

**Option B: Vercel Dashboard**
1. Go to https://vercel.com/new
2. Import your Git repository
3. Set root directory to: `darkagent/frontend`
4. Framework preset: Vite
5. Build command: `npm run build`
6. Output directory: `dist`

### 3. Configure Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add:

**Required:**
- `VITE_DARKAGENT_API_URL` = Your backend API URL (e.g., https://your-backend.railway.app)
- `VITE_CHAIN_ID` = `84532` (Base Sepolia)
- `VITE_RPC_URL` = `https://sepolia.base.org`

**After Contract Deployment:**
- `VITE_DARKAGENT_CONTRACT` = Your DarkAgent contract address
- `VITE_VERIFIER_CONTRACT` = Your Verifier contract address
- `VITE_CAPABILITY_CONTRACT` = Your capability contract address

**Optional:**
- `VITE_DEFAULT_ENS` = `alice.eth` (or your ENS name)
- `VITE_LIT_ACTION_CID` = Your Lit Action CID (if using Lit Protocol)
- `VITE_VERCEL_APP_URL` = Your Vercel app URL (auto-set by Vercel)

### 4. Redeploy After Adding Variables
After adding environment variables, trigger a new deployment:
- Vercel Dashboard → Deployments → Redeploy

## 📦 Backend Deployment (Railway/Render)

### Railway Deployment
```bash
cd darkagent
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set environment variables in Railway dashboard from your `.env` file.

### Render Deployment
1. Go to https://render.com/
2. New → Web Service
3. Connect your repository
4. Root directory: `darkagent`
5. Build command: `npm install`
6. Start command: `npm run blink:server`
7. Add all environment variables from `.env`

## 🔗 Smart Contract Deployment

### Deploy to Base Sepolia
```bash
cd darkagent

# 1. Set up environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY, BASE_SEPOLIA_RPC, BASESCAN_API_KEY

# 2. Install dependencies
npm install

# 3. Compile contracts
npm run compile

# 4. Deploy contracts
npm run deploy

# 5. Verify on Basescan
npm run verify
```

### After Deployment
Copy the contract addresses from the deployment output and:
1. Update `darkagent/.env`
2. Update Vercel environment variables
3. Update `frontend/src/contracts/deployment.json` (auto-generated)

## 🧪 Testing Before Production

### Local Testing
```bash
# Terminal 1: Backend
cd darkagent
npm run blink:server

# Terminal 2: Frontend
cd darkagent/frontend
npm run dev
```

### Build Testing
```bash
cd darkagent/frontend
npm run build
npm run preview
```

## 📋 Post-Deployment Verification

- [ ] Frontend loads on Vercel URL
- [ ] Wallet connection works
- [ ] Contract interactions work
- [ ] Backend API responds
- [ ] ENS resolution works
- [ ] Blink analysis works
- [ ] Execution flow completes

## 🔧 Troubleshooting

### Build Fails on Vercel
- Check Node.js version (should be 18+)
- Verify all dependencies are in `package.json`
- Check build logs for specific errors

### Environment Variables Not Working
- Ensure all `VITE_` prefixed variables are set
- Redeploy after adding variables
- Check browser console for undefined variables

### Contract Interaction Fails
- Verify contract addresses are correct
- Check RPC URL is accessible
- Ensure wallet is on Base Sepolia network
- Check contract is verified on Basescan

## 📚 Useful Commands

```bash
# Check build locally
npm run build

# Preview production build
npm run preview

# Deploy to Vercel
vercel --prod

# Check Vercel logs
vercel logs

# List Vercel deployments
vercel ls
```

## 🎯 Current Status

✅ Frontend build: **PASSING**
✅ Vercel config: **CREATED**
⏳ Contracts: **PENDING DEPLOYMENT**
⏳ Backend: **PENDING DEPLOYMENT**
⏳ Vercel: **READY TO DEPLOY**

## 🚀 Next Steps

1. Deploy smart contracts to Base Sepolia
2. Deploy backend to Railway/Render
3. Update Vercel environment variables
4. Deploy frontend to Vercel
5. Test end-to-end flow

---

**Need Help?**
- Vercel Docs: https://vercel.com/docs
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- Railway Docs: https://docs.railway.app/
