#!/bin/bash

echo "🚀 DarkAgent Render Deployment Helper"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the darkagent directory."
    exit 1
fi

echo "✅ Checking Node.js version..."
node_version=$(node -v)
echo "   Node version: $node_version"

if [[ "$node_version" < "v18" ]]; then
    echo "⚠️  Warning: Node.js 18+ recommended. You have $node_version"
fi

echo ""
echo "✅ Verifying ethers.js v6 imports..."
node -e "const { Wallet, getBytes, keccak256 } = require('ethers'); console.log('   ✓ ethers v6 imports working');" || {
    echo "❌ Error: ethers imports failed. Run 'npm install' first."
    exit 1
}

echo ""
echo "✅ Checking required files..."
[ -f "server/index.js" ] && echo "   ✓ server/index.js" || echo "   ✗ server/index.js missing"
[ -f "server/lib/proofService.js" ] && echo "   ✓ proofService.js" || echo "   ✗ proofService.js missing"
[ -f ".env" ] && echo "   ✓ .env exists" || echo "   ⚠️  .env not found (needed for local testing)"

echo ""
echo "📝 Pre-deployment checklist:"
echo ""
echo "1. ✅ Code is ready (ethers v6 compatible)"
echo "2. ⏳ Commit and push changes:"
echo "   git add ."
echo "   git commit -m 'Fix Render deployment - ethers v6'"
echo "   git push"
echo ""
echo "3. ⏳ In Render Dashboard:"
echo "   a. Go to your service"
echo "   b. Settings → Build & Deploy"
echo "   c. Click 'Clear build cache' ⚠️ IMPORTANT"
echo "   d. Click 'Manual Deploy' → 'Deploy latest commit'"
echo ""
echo "4. ⏳ Set environment variables in Render:"
echo "   - NODE_VERSION=18.20.0"
echo "   - All variables from your .env file"
echo ""
echo "5. ⏳ Monitor deployment:"
echo "   - Watch logs in Render dashboard"
echo "   - Look for 'Server running on port...'"
echo ""
echo "📚 Full guide: See RENDER_DEPLOYMENT.md"
echo ""
echo "🔗 Quick links:"
echo "   Render Dashboard: https://dashboard.render.com/"
echo "   Render Docs: https://render.com/docs/node-version"
echo ""
