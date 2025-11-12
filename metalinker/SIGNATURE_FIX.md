# Fixing "Signature Validation Failed" Error

## ⚠️ Most Common Cause: Signature Rejected in MetaMask

**90% of the time, this error means you rejected or didn't approve the signature in MetaMask.**

### Quick Fix Steps:

1. **Open MetaMask** (click the extension icon)
2. **Check for pending notifications** - look for a signature request
3. **If you see a pending request:**
   - Click on it
   - Click "Sign" (NOT "Reject")
   - Wait for confirmation

4. **If no pending request:**
   - Disconnect wallet in the app
   - Refresh the page
   - Reconnect wallet
   - **When MetaMask pops up asking to sign → CLICK "SIGN"**

## 🔍 Debugging Steps

### Step 1: Check Browser Console

Open browser console (F12) and look for these messages:

```
🔐 XMTP signMessage called with: ...
📍 Signing with address: 0x...
🔄 Attempting viem signMessage...
✅ Successfully signed with...
```

**What to look for:**
- ✅ "Successfully signed" = Signature was created correctly
- ❌ "failed" or "rejected" = Signature was rejected
- ⚠️ "Invalid signature format" = Signature format issue

### Step 2: Check MetaMask

1. Open MetaMask extension
2. Click the "Activity" tab
3. Look for recent signature requests
4. If you see a rejected request, that's the problem!

### Step 3: Verify Network

Make sure you're on **Polygon Mainnet** (Chain ID: 137)
- Wrong network can cause signature validation to fail

## 🛠️ Complete Reset Procedure

If nothing works, try this complete reset:

1. **Disconnect wallet** in the app
2. **Close browser completely**
3. **Clear browser cache** (or use incognito mode)
4. **Open browser and go to** http://localhost:3000
5. **Connect wallet** again
6. **Switch to Polygon** network in MetaMask
7. **When signature prompt appears:**
   - **READ the message** (it's safe, just XMTP initialization)
   - **CLICK "SIGN"** (not "Reject")
   - **WAIT** for it to complete

## 📋 Checklist

Before reporting an issue, verify:

- [ ] MetaMask is unlocked
- [ ] You're on Polygon network (Chain ID: 137)
- [ ] You clicked "Sign" (not "Reject") when prompted
- [ ] No pending signature requests in MetaMask
- [ ] Browser console shows "Successfully signed" message
- [ ] `.env.local` file exists with correct API keys
- [ ] Dev server is running (`npm run dev`)

## 🐛 Still Not Working?

If you've tried everything above:

1. **Check console logs** - copy the full error message
2. **Check MetaMask activity** - screenshot any rejected requests
3. **Try a different wallet** - if you have multiple accounts
4. **Try incognito mode** - to rule out cache issues
5. **Check XMTP environment** - make sure `NEXT_PUBLIC_XMTP_ENV=dev` in `.env.local`

## 💡 Understanding the Error

"Signature validation failed" means:
- XMTP received a signature
- But when it tried to verify it matches your wallet address
- The verification failed

**This usually happens when:**
1. You rejected the signature (most common)
2. The signature format is wrong (rare, but possible)
3. Network mismatch (wrong chain)
4. Wallet connection issue

## ✅ Success Indicators

You'll know it worked when you see:
- ✅ "Successfully signed" in console
- ✅ "Signer created successfully" in console
- ✅ Status changes to "ready" in the app
- ✅ No more signature errors

