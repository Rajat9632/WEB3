# Quick Start - Get Running in 5 Minutes

## Step 1: Create `.env.local` File

Create a file named `.env.local` in the `metalinker` folder:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
# You can use either format:
# Full URL: https://polygon-mainnet.g.alchemy.com/v2/your_key
# Or just the key: your_key
NEXT_PUBLIC_ALCHEMY_API_KEY=your_key
NEXT_PUBLIC_XMTP_ENV=dev
```

**Get API Keys:**
- WalletConnect: https://cloud.reown.com (free, takes 2 minutes)
- Alchemy: https://www.alchemy.com (free tier available)

## Step 2: Install & Run

```bash
npm install
npm run dev
```

## Step 3: Test in Browser

1. Open http://localhost:3000
2. Click "Connect Wallet" → Select MetaMask
3. **Switch to Polygon network** in MetaMask (if not already)
4. When XMTP asks you to sign a message → **CLICK "SIGN"** (don't reject!)
5. Wait for "Ready" status

## Step 4: Test Messaging

**Option A: Two Browser Windows**
- Window 1: Connect Wallet A
- Window 2 (Incognito): Connect Wallet B
- Send message from A to B's address

**Option B: Test with Friend**
- Share your wallet address
- Friend connects their wallet
- Start chatting!

## ⚠️ Common Issues

### "Signature error"
- **Solution**: Make sure you clicked "Sign" in MetaMask (not "Reject")
- Disconnect wallet and reconnect
- Clear browser cache

### "Module not found"
- Run: `rm -rf node_modules && npm install`

### Wallet won't connect
- Check `.env.local` has WalletConnect Project ID
- Make sure MetaMask is unlocked

## Full Testing Guide

See `TESTING_GUIDE.md` for detailed instructions on all features.

