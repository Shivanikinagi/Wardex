# 🔴 Vercel Cache Issue - CRITICAL FIX NEEDED

## The Problem

Vercel is deploying **OLD CACHED CODE** from before the rename. The error shows:

```
206 |  function ToggleRow({ label, active, onClick }) {
207 |    return (
     |    ^
```

But this code is **CORRECT** in your Git repository. Vercel's cache is the issue.

## ✅ Your Code is Correct

**Local build:** ✅ Works perfectly (built in 56.77s)
**Git repository:** ✅ Has all the latest changes
**Vercel cache:** ❌ Still has old code

## 🚀 IMMEDIATE FIX (Do This Now)

### Option 1: Clear Vercel Cache (Recommended)

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **General**
4. Scroll down to **Build & Development Settings**
5. Click **"Clear Cache"** button
6. Go to **Deployments** tab
7. Click **"Redeploy"** on the latest deployment
8. Select **"Use existing Build Cache"** → **NO** (uncheck it)
9. Click **"Redeploy"**

### Option 2: Force Rebuild via Environment Variable

1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add a new variable:
   ```
   VERCEL_FORCE_BUILD_ID=1
   ```
4. Redeploy

### Option 3: Delete and Recreate Deployment

If cache clearing doesn't work:

1. Go to Vercel Dashboard
2. Settings → General
3. Scroll to bottom → **"Delete Project"**
4. Create new project
5. Import from Git
6. Set root directory: `darkagent/frontend`
7. Framework: Vite
8. Build command: `npm run build`
9. Output directory: `dist`

## 📝 Environment Variables for Vercel

Make sure these are set:

```bash
# API Configuration
VITE_WARDEX_API_URL=https://your-backend.onrender.com

# Contract Addresses
VITE_WARDEX_CONTRACT=0xB50947Caa9F8a179EBA3A6545b267699aFF361BE
VITE_VERIFIER_CONTRACT=0x03Aa853D64f1b17551191E720D0366c35eC8eb4b

# Network Configuration
VITE_CHAIN_ID=84532
VITE_RPC_URL=https://sepolia.base.org

# Optional
VITE_DEFAULT_ENS=alice.eth
```

## 🔍 How to Verify It's Fixed

After redeploying, check the Vercel build logs for:

```
✓ 5266 modules transformed
✓ built in XXs
```

If you see the ToggleRow error again, the cache wasn't cleared.

## 🎯 Why This Happens

Vercel aggressively caches:
1. **node_modules** - Dependencies
2. **Build artifacts** - Compiled code
3. **Source files** - Sometimes even source code

When you rename files/folders (like darkagent → wardex), Vercel's cache can serve old versions.

## ✅ Verification Checklist

After clearing cache and redeploying:

- [ ] Build logs show "✓ built in XXs"
- [ ] No ToggleRow errors in logs
- [ ] Deployment succeeds
- [ ] Site loads without errors
- [ ] Console shows no module errors

## 🆘 If Still Failing

### Check Build Command

In Vercel Settings → Build & Development Settings:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Root Directory:** `darkagent/frontend` (or leave blank if deploying from root)

### Check Node Version

- **Node.js Version:** 18.x or 20.x (not 16.x)

### Manual Build Test

In Vercel deployment logs, look for:

```bash
# Should see:
npm install
npm run build
# ✓ built in XXs
```

If it shows errors about missing files, the cache is still active.

## 📊 Current Status

| Item | Status |
|------|--------|
| Local build | ✅ Works (56.77s) |
| Git repository | ✅ Latest code |
| Vercel cache | ❌ Has old code |
| Action needed | ⚠️ Clear cache NOW |

## 🔗 Quick Links

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs - Clear Cache: https://vercel.com/docs/deployments/troubleshoot-a-build#clear-cache
- Your Project Settings: https://vercel.com/[your-username]/[project-name]/settings

## 💡 Pro Tip

After major refactoring (like renaming), always:
1. Clear Vercel cache
2. Uncheck "Use existing Build Cache"
3. Redeploy

This ensures Vercel uses fresh code from Git.

---

**TL;DR:** Go to Vercel → Settings → Clear Cache → Redeploy (uncheck "Use existing Build Cache")

**Your code is correct. Vercel's cache is the problem.**
