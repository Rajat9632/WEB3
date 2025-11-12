# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create `.env.local` file**
   
   Copy the template below and fill in your API keys:
   ```env
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_ALCHEMY_API_KEY=https://polygon-mainnet.g.alchemy.com/v2/your_key_here
   NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_here
   NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
   NEXT_PUBLIC_XMTP_ENV=dev
   ```

3. **Get API Keys**

   **WalletConnect Project ID:**
   - Go to https://cloud.reown.com
   - Create a new project
   - Copy the Project ID

   **Alchemy API Key:**
   - Go to https://www.alchemy.com
   - Create an account
   - Create a new app on Polygon Mainnet
   - Copy the HTTP URL (full URL, not just the key)

   **Pinata JWT:**
   - Go to https://pinata.cloud
   - Create an account
   - Go to API Keys section
   - Create a new key with "pinFileToIPFS" permission
   - Copy the JWT token

4. **Run the App**
   ```bash
   npm run dev
   ```

5. **Test the App**
   - Open http://localhost:3000
   - Connect your MetaMask wallet
   - Sign the XMTP initialization message
   - Start chatting!

## Testing with Multiple Wallets

1. Create 2-3 test wallets in MetaMask
2. Fund them with a small amount of MATIC (for gas)
3. Connect each wallet in separate browser windows/incognito tabs
4. Send messages between them to test the functionality

## Features to Test

- ✅ Send/receive messages
- ✅ ENS name resolution (try sending to `vitalik.eth`)
- ✅ File sharing (click 📎 icon)
- ✅ In-chat payments (💰 Pay button)
- ✅ Token swaps (`/swap 1 ETH USDC`)
- ✅ Video calls (📹 Video Call button)

## Troubleshooting

**XMTP initialization fails:**
- Make sure you're on Polygon network
- Check that you have MATIC for gas
- Try switching XMTP_ENV to "dev" in .env.local

**File upload fails:**
- Verify your Pinata JWT is correct
- Check that the JWT has "pinFileToIPFS" permission

**ENS resolution fails:**
- Ensure your Alchemy API key has access to Ethereum mainnet (for ENS)
- ENS names resolve on Ethereum, but you can still message on Polygon

**Video calls not working:**
- Allow camera/microphone permissions
- Both users need to be in the same conversation
- WebRTC requires proper network configuration (may not work behind strict firewalls)

## Production Deployment

Before deploying to production:

1. Change `NEXT_PUBLIC_XMTP_ENV` to `production` in `.env.local`
2. Update Alchemy URL to production endpoint
3. Test all features thoroughly
4. Consider adding error boundaries and better error handling
5. Set up proper monitoring and logging

