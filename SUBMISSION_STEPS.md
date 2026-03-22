# Wardex - Step-by-Step Submission Guide

## Prerequisites Checklist

Before you start, make sure you have:
- [ ] GitHub account with Wardex repository
- [ ] Ethereum wallet address (MetaMask, Coinbase Wallet, etc.)
- [ ] Email address for registration
- [ ] Twitter account (for promotion)

---

## Step 1: Register at The Synthesis

### 1.1 Register Your Participant Identity

```bash
curl -X POST https://synthesis.devfolio.co/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "name": "Your Name",
    "githubUsername": "Shivanikinagi",
    "twitterHandle": "your_twitter",
    "teamName": "Wardex Team"
  }'
```

**Response will include:**
- `apiKey` - **SAVE THIS!** You only get it once
- `participantUUID` - Your unique ID
- `teamUUID` - Your team's unique ID
- `agentId` - Your on-chain agent NFT ID

**Save these values:**
```bash
export SYNTHESIS_API_KEY="sk-synth-..."
export TEAM_UUID="..."
export PARTICIPANT_UUID="..."
```

---

## Step 2: Get Track UUIDs

### 2.1 Browse Available Tracks

```bash
curl https://synthesis.devfolio.co/catalog?page=1&limit=20
```

### 2.2 Find and Save Track UUIDs

Look for these tracks and save their UUIDs:

1. **Base - Agent Services** - Look for "Base" or "Agent Services"
2. **Filecoin - Agentic Storage** - Look for "Filecoin" or "Agentic Storage"
3. **Lido - stETH Treasury** - Look for "Lido" or "stETH"
4. **ENS Identity** - Look for "ENS" or "Identity"
5. **Lit Protocol - Dark Knowledge** - Look for "Lit" or "Dark Knowledge"
6. **Zyfai - Yield Powered Agent** - Look for "Zyfai" or "Yield"
7. **Synthesis Open Track** - Look for "Open Track" or "Synthesis"

**Save the UUIDs:**
```bash
export BASE_TRACK_UUID="..."
export FILECOIN_TRACK_UUID="..."
export LIDO_TRACK_UUID="..."
export ENS_TRACK_UUID="..."
export LIT_TRACK_UUID="..."
export ZYFAI_TRACK_UUID="..."
export OPEN_TRACK_UUID="..."
```

---

## Step 3: Transfer to Self-Custody (REQUIRED)

### 3.1 Get Your Wallet Address

If you don't have one:
1. Install MetaMask: https://metamask.io/
2. Create a new wallet
3. **SAVE YOUR SEED PHRASE SECURELY**
4. Copy your wallet address (starts with 0x...)

```bash
export WALLET_ADDRESS="0xYourWalletAddress"
```

### 3.2 Initiate Transfer

```bash
curl -X POST https://synthesis.devfolio.co/participants/me/transfer/init \
  -H "Authorization: Bearer $SYNTHESIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"targetOwnerAddress\": \"$WALLET_ADDRESS\"
  }"
```

**Response includes:**
- `transferToken` - Single-use token (expires in 15 minutes)
- `targetOwnerAddress` - **VERIFY THIS MATCHES YOUR WALLET!**
- `agentId` - Your agent NFT ID
- `expiresInSeconds` - Time remaining

**Save the transfer token:**
```bash
export TRANSFER_TOKEN="tok_..."
```

### 3.3 Confirm Transfer

**⚠️ IMPORTANT: Verify the address matches before confirming!**

```bash
curl -X POST https://synthesis.devfolio.co/participants/me/transfer/confirm \
  -H "Authorization: Bearer $SYNTHESIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"transferToken\": \"$TRANSFER_TOKEN\",
    \"targetOwnerAddress\": \"$WALLET_ADDRESS\"
  }"
```

**Success response:**
- `status: "transfer_complete"`
- `custodyType: "self_custody"`
- `txHash` - On-chain transaction hash
- `selfCustodyVerifiedAt` - Timestamp

**✅ You now own your agent NFT on-chain!**

---

## Step 4: Create Moltbook Post

### 4.1 Go to Moltbook

Visit: https://www.moltbook.com/

### 4.2 Create Account

Sign up with your email or connect wallet

### 4.3 Create Post

1. Click "Create Post"
2. Use the template from `MOLTBOOK_POST.md`
3. Add screenshots:
   - Wardex dashboard
   - Blink analysis page
   - Transaction on Base Sepolia explorer
4. Publish the post

### 4.4 Save Post URL

```bash
export MOLTBOOK_URL="https://www.moltbook.com/posts/abc123"
```

---

## Step 5: Prepare Media Assets

### 5.1 Record Demo Video

**What to show (2-5 minutes):**
1. Landing page overview
2. Policy configuration in dashboard
3. Creating a Blink
4. Analyzing a Blink with risk scoring
5. Viewing execution proof on Filecoin
6. Transaction on Base Sepolia explorer

**Upload to:**
- YouTube: https://youtube.com/upload
- Or Loom: https://loom.com/

```bash
export VIDEO_URL="https://youtube.com/watch?v=..."
```

### 5.2 Take Screenshots

**Capture:**
1. Landing page
2. Dashboard with policy settings
3. Blink analysis with risk score
4. Activity feed
5. Base Sepolia transaction
6. Filecoin proof

**Upload to Imgur:**
1. Go to https://imgur.com/upload
2. Upload all screenshots
3. Create an album
4. Get album URL

```bash
export PICTURES_URL="https://imgur.com/a/..."
export COVER_IMAGE_URL="https://imgur.com/..."
```

---

## Step 6: Update Submission Payload

### 6.1 Edit submission-payload.json

Replace all placeholder values:

```bash
cd darkagent

# Open in editor
nano submission-payload.json

# Or use sed to replace values
sed -i "s/<YOUR_TEAM_UUID_FROM_REGISTRATION>/$TEAM_UUID/g" submission-payload.json
sed -i "s/<BASE_AGENT_SERVICES_TRACK_UUID>/$BASE_TRACK_UUID/g" submission-payload.json
sed -i "s/<FILECOIN_AGENTIC_STORAGE_TRACK_UUID>/$FILECOIN_TRACK_UUID/g" submission-payload.json
sed -i "s/<LIDO_STETH_TREASURY_TRACK_UUID>/$LIDO_TRACK_UUID/g" submission-payload.json
sed -i "s/<ENS_IDENTITY_TRACK_UUID>/$ENS_TRACK_UUID/g" submission-payload.json
sed -i "s/<LIT_PROTOCOL_DARK_KNOWLEDGE_TRACK_UUID>/$LIT_TRACK_UUID/g" submission-payload.json
sed -i "s/<ZYFAI_YIELD_POWERED_AGENT_TRACK_UUID>/$ZYFAI_TRACK_UUID/g" submission-payload.json
sed -i "s/<SYNTHESIS_OPEN_TRACK_UUID>/$OPEN_TRACK_UUID/g" submission-payload.json
sed -i "s|<CREATE_POST_AT_MOLTBOOK_AND_ADD_URL>|$MOLTBOOK_URL|g" submission-payload.json
sed -i "s|<UPLOAD_DEMO_VIDEO_AND_ADD_URL>|$VIDEO_URL|g" submission-payload.json
sed -i "s|<UPLOAD_SCREENSHOTS_TO_IMGUR_AND_ADD_URL>|$PICTURES_URL|g" submission-payload.json
sed -i "s|<UPLOAD_COVER_IMAGE_TO_IMGUR_AND_ADD_URL>|$COVER_IMAGE_URL|g" submission-payload.json
```

---

## Step 7: Create Draft Project

### 7.1 Submit Project

```bash
curl -X POST https://synthesis.devfolio.co/projects \
  -H "Authorization: Bearer $SYNTHESIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @submission-payload.json
```

**Success response includes:**
- `uuid` - **SAVE THIS!** Your project UUID
- `status: "draft"`
- `name: "Wardex"`
- Full project details

```bash
export PROJECT_UUID="..."
```

### 7.2 Verify Project

```bash
curl https://synthesis.devfolio.co/projects/$PROJECT_UUID
```

Check that all fields are correct.

---

## Step 8: Update Project (If Needed)

### 8.1 Make Changes

If you need to update anything:

```bash
curl -X POST https://synthesis.devfolio.co/projects/$PROJECT_UUID \
  -H "Authorization: Bearer $SYNTHESIS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deployedURL": "https://wardex.vercel.app",
    "videoURL": "https://youtube.com/watch?v=...",
    "pictures": "https://imgur.com/a/...",
    "coverImageURL": "https://imgur.com/..."
  }'
```

---

## Step 9: Publish Project

### 9.1 Final Checklist

Before publishing, verify:
- [ ] All team members have completed self-custody transfer
- [ ] Project name is set
- [ ] Description is complete
- [ ] Problem statement is clear
- [ ] Repository URL is correct
- [ ] At least one track is selected
- [ ] Conversation log is included
- [ ] Submission metadata is complete
- [ ] Moltbook post URL is set
- [ ] Deployed URL is working
- [ ] Video URL is accessible
- [ ] Screenshots are uploaded

### 9.2 Publish

**⚠️ Only team admin can publish!**

```bash
curl -X POST https://synthesis.devfolio.co/projects/$PROJECT_UUID/publish \
  -H "Authorization: Bearer $SYNTHESIS_API_KEY"
```

**Success response:**
- `status: "publish"`
- `slug: "wardex-a1b2"`
- Project is now live!

---

## Step 10: Promote Your Project

### 10.1 Tweet About It

**Tweet template:**

```
🚀 Just submitted Wardex to @synthesis_md!

A policy firewall for AI agents in DeFi - because agents shouldn't have unlimited wallet access.

✅ ENS-based policies
✅ AI risk scoring
✅ Yield-only spending
✅ Immutable proofs on Filecoin

Check it out: https://wardex.vercel.app

#TheSynthesis #DeFi #AIAgents
```

### 10.2 Share on Moltbook

Update your Moltbook post with:
- "✅ Submitted to The Synthesis!"
- Link to deployed app
- Link to demo video

### 10.3 Engage with Community

- Respond to comments on Moltbook
- Answer questions on Twitter
- Join The Synthesis Discord
- Share updates on progress

---

## Troubleshooting

### Error: "Not a member of this project's team"
- You're not on the team that owns the project
- Verify your team UUID

### Error: "Only team admins can publish projects"
- Ask the team admin to publish
- Or make yourself admin via team management

### Error: "All team members must transfer their agent to self-custody"
- Every team member must complete Step 3
- Check transfer status: `GET /participants/me`

### Error: "Project must have a name before publishing"
- Update project with name via Step 8

### Error: "Track not found"
- One of your track UUIDs is invalid
- Re-check catalog and update UUIDs

---

## Quick Reference

### Important URLs
- **Synthesis API**: https://synthesis.devfolio.co
- **Moltbook**: https://www.moltbook.com/
- **Wardex Repo**: https://github.com/Shivanikinagi/Wardex
- **Wardex App**: https://wardex.vercel.app
- **Base Sepolia Explorer**: https://sepolia.basescan.org/

### Key Commands

```bash
# Register
POST /register

# Get tracks
GET /catalog

# Transfer to self-custody
POST /participants/me/transfer/init
POST /participants/me/transfer/confirm

# Create project
POST /projects

# Update project
POST /projects/:uuid

# Publish project
POST /projects/:uuid/publish
```

---

## Support

If you need help:
1. Check The Synthesis documentation
2. Ask in The Synthesis Discord
3. Review error messages carefully
4. Verify all prerequisites are met

---

**Good luck with your submission! 🚀**
