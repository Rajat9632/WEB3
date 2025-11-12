# Testing Guide - Web3 Messenger

## Quick Start Testing

### 1. Prerequisites Setup

**Create `.env.local` file:**
```env
# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_ALCHEMY_API_KEY=https://polygon-mainnet.g.alchemy.com/v2/your_key_here

# Optional (for file sharing)
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_here
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/

# XMTP Environment (use 'dev' for testing)
NEXT_PUBLIC_XMTP_ENV=dev
```

**Get API Keys:**
- **WalletConnect**: https://cloud.reown.com → Create Project → Copy Project ID
- **Alchemy**: https://www.alchemy.com → Create App → Copy HTTP URL
- **Pinata** (optional): https://pinata.cloud → API Keys → Create JWT

### 2. Start the Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 3. Connect Your Wallet

1. Click "Connect Wallet" button
2. Select MetaMask (or your preferred wallet)
3. **Approve the connection**
4. **Switch to Polygon network** if prompted (or manually switch in MetaMask)
5. You should see "Initializing XMTP..." message

### 4. Initialize XMTP (First Time Only)

When you first connect, XMTP will ask you to **sign a message**:
- This is a one-time setup to create your XMTP identity
- **Click "Sign" in MetaMask** - this is safe, it's just creating your messaging keys
- After signing, XMTP client will be ready

**⚠️ Important:** If you see "Signature error", try:
- Make sure you're on Polygon network
- Disconnect and reconnect your wallet
- Clear browser cache and try again
- Make sure you actually clicked "Sign" in MetaMask (don't reject it)

### 5. Test Basic Messaging

**Setup Two Wallets (Recommended):**

1. **Window 1**: Connect Wallet A
2. **Window 2** (Incognito): Connect Wallet B

**Send a Message:**
1. In Wallet A's window, enter Wallet B's address in "New Chat"
2. Click "+" or press Enter
3. Type a message and send
4. Switch to Wallet B's window - you should see the message appear!

### 6. Test Features

#### ✅ ENS Resolution
- Try sending to: `vitalik.eth` (or any .eth name)
- The app will automatically resolve it to an address

#### ✅ File Sharing
1. Click the 📎 icon in message input
2. Select a file
3. File will be uploaded to IPFS and link sent
4. Recipient can click the link to view

#### ✅ In-Chat Payments
1. Open a conversation
2. Click "💰 Pay" button
3. Enter amount in MATIC
4. Confirm transaction in MetaMask

#### ✅ Token Swaps
Type in chat:
```
/swap 1 ETH USDC
```
- This will show a swap quote
- Click "Confirm" to execute (requires actual swap integration)

#### ✅ Video Calls
1. Open a conversation
2. Click "📹 Video Call" button
3. Allow camera/microphone permissions
4. Both users need to be in the conversation

## Troubleshooting

### "Signature error" when initializing XMTP

**Causes:**
- Wallet not properly connected
- Message signing was rejected
- Network mismatch (not on Polygon)
- Browser cache issues

**Solutions:**
1. **Disconnect and reconnect wallet**
2. **Make sure you're on Polygon network** (chain ID: 137)
3. **Clear browser cache** and reload
4. **Check MetaMask** - make sure you clicked "Sign" not "Reject"
5. **Try a different wallet** to test if it's wallet-specific
6. **Check console** for detailed error messages

### "Module not found" errors

If you see module errors:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Wallet won't connect

1. Make sure MetaMask is installed and unlocked
2. Check that WalletConnect Project ID is set in `.env.local`
3. Try refreshing the page
4. Check browser console for errors

### Messages not appearing

1. Make sure both wallets are connected
2. Check that XMTP initialization completed (no errors)
3. Try sending from the other wallet
4. Check network connection
5. Verify you're using the same XMTP environment (`dev` or `production`)

### XMTP Environment

- **`dev`**: For testing - use this during development
- **`production`**: For mainnet - use this when ready for real users

**Important:** Users on `dev` can only message other `dev` users. Same for `production`.

### Database Errors (Non-Critical)

You might see "Database(NotFound)" errors in console. These are **non-critical** - they're just XMTP's internal database initialization. The app will still work.

## Testing Checklist

- [ ] Wallet connects successfully
- [ ] XMTP initializes (signature prompt works)
- [ ] Can create new conversation
- [ ] Can send messages
- [ ] Can receive messages (test with 2 wallets)
- [ ] ENS resolution works (.eth names)
- [ ] File sharing works (if Pinata configured)
- [ ] Payment modal opens
- [ ] Video call button works (may need 2 users)

## Common Issues

### Issue: "Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
**Fix:** Add the key to `.env.local` file

### Issue: "Pinata JWT not configured"
**Fix:** Either add `NEXT_PUBLIC_PINATA_JWT` to `.env.local` or file sharing won't work (other features still work)

### Issue: "Failed to resolve ENS name"
**Fix:** Make sure `NEXT_PUBLIC_ALCHEMY_API_KEY` has access to Ethereum mainnet (for ENS resolution)

### Issue: Video calls not connecting
**Fix:** 
- Both users need to be in the same conversation
- Allow camera/microphone permissions
- May not work behind strict firewalls/NAT

## Need Help?

1. Check browser console for detailed errors
2. Check Network tab for failed API calls
3. Verify all environment variables are set
4. Make sure you're on the correct network (Polygon)
5. Try disconnecting and reconnecting wallet

## Production Deployment

Before deploying:
1. Change `NEXT_PUBLIC_XMTP_ENV` to `production`
2. Test all features thoroughly
3. Update API keys to production endpoints
4. Set up proper error monitoring

