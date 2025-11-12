# Troubleshooting Guide

## Signature Validation Failed Error

If you see: `Error: Signature error Signature validation failed`

### Common Causes:

1. **Message signing was rejected or cancelled**
   - **Solution**: When MetaMask prompts you to sign, you MUST click "Sign" (not "Reject")
   - Disconnect and reconnect your wallet, then try again
   - Make sure you actually see and approve the signature request

2. **Wallet not properly connected**
   - **Solution**: 
     - Disconnect wallet completely
     - Refresh the page
     - Reconnect wallet
     - Make sure you're on Polygon network

3. **Browser cache issues**
   - **Solution**:
     - Clear browser cache and cookies
     - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
     - Try in incognito/private mode

4. **Network mismatch**
   - **Solution**: Make sure MetaMask is on Polygon network (Chain ID: 137)
   - Switch networks in MetaMask if needed

5. **XMTP environment mismatch**
   - **Solution**: Make sure both users are on the same XMTP environment (`dev` or `production`)
   - Check your `.env.local` has `NEXT_PUBLIC_XMTP_ENV=dev` (or `production`)

### Step-by-Step Fix:

1. **Disconnect wallet** (click "Disconnect" button)
2. **Clear browser cache** (or use incognito mode)
3. **Refresh page** completely
4. **Reconnect wallet** via "Connect Wallet" button
5. **Switch to Polygon** network in MetaMask
6. **When signature prompt appears** → Click "Sign" (NOT "Reject")
7. **Wait for initialization** to complete

### Database Errors (Non-Critical)

You might see errors like:
```
ERROR xmtp_mls::worker: Worker error: Metadata(Connection(Database(NotFound)))
```

**These are NON-CRITICAL** - they're just XMTP's internal database initialization. The app will still work. You can ignore these.

### Still Not Working?

1. **Check browser console** for detailed error messages
2. **Try a different wallet** (if you have multiple)
3. **Check MetaMask notifications** - make sure you didn't accidentally reject a signature
4. **Verify environment variables** are set correctly in `.env.local`
5. **Try switching XMTP environment**:
   - Change `NEXT_PUBLIC_XMTP_ENV=dev` to `production` (or vice versa)
   - Restart dev server
   - Try again

### Debug Mode

The signer now logs detailed information. Check browser console for:
- "XMTP signMessage called with:" - shows what message format XMTP is sending
- "Successfully signed with..." - shows which signing method worked
- Any error messages with details

## HTTP 404 Errors

If you see HTTP 404 errors when making RPC calls:

**Problem**: Alchemy API key format issue

**Solution**: 
- Make sure `NEXT_PUBLIC_ALCHEMY_API_KEY` in `.env.local` is either:
  - Full URL: `https://polygon-mainnet.g.alchemy.com/v2/your_key`
  - Or just the key: `your_key`
- Both formats work now!

## Wallet Won't Connect

1. Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in `.env.local`
2. Make sure MetaMask is installed and unlocked
3. Try refreshing the page
4. Check browser console for errors

## Messages Not Appearing

1. Make sure both wallets are connected
2. Verify XMTP initialization completed (no errors)
3. Check you're using the same XMTP environment (`dev` or `production`)
4. Try sending from the other wallet
5. Check network connection

## Need More Help?

- Check browser console for detailed errors
- Check Network tab for failed API calls
- Verify all environment variables are set
- Make sure you're on the correct network (Polygon)

