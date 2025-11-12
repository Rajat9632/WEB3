# Web3 Messenger - Decentralized Messaging Application

A fully-featured decentralized messaging application built on Polygon, XMTP, IPFS, and Web3 technologies.

## 🚀 Features

### Phase 1: Foundation (MVP)
- ✅ **Wallet Connection**: Connect with MetaMask and other EOA wallets via Web3Modal
- ✅ **XMTP Messaging**: End-to-end encrypted messaging using XMTP protocol
- ✅ **Contact List**: View and manage all your conversations
- ✅ **Real-time Messaging**: Live message streaming with instant updates
- ✅ **ENS Resolution**: Resolve `.eth` names to addresses automatically
- ✅ **IPFS File Sharing**: Encrypt and share files via IPFS (Pinata)

### Phase 2: Web3-Native Features
- ✅ **Token-Gated Groups**: Create groups that require NFT or token ownership
- ✅ **In-Chat Payments**: Send MATIC directly from the chat interface
- ✅ **Executable Commands**: Use `/swap` command for token swaps

### Phase 3: Advanced Features
- ✅ **WebRTC Video Calling**: Peer-to-peer encrypted video calls
- ⏳ **Account Abstraction**: Smart contract wallets for Web2-like experience (Coming Soon)

## 🛠️ Tech Stack

- **Frontend**: React (Next.js 14)
- **Blockchain**: Polygon (PoS)
- **Messaging**: XMTP (browser-sdk)
- **Storage**: IPFS via Pinata
- **Wallets**: Wagmi & Web3Modal
- **Identity**: ENS for `.eth` names
- **Video**: WebRTC for P2P calls

## 📋 Prerequisites

- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- API keys for:
  - WalletConnect (from [Reown Cloud](https://cloud.reown.com))
  - Alchemy (for Polygon RPC)
  - Pinata (for IPFS)

## 🔧 Setup

1. **Clone and Install**
   ```bash
   cd metalinker
   npm install
   ```

2. **Configure Environment Variables**
   
   Create a `.env.local` file in the `metalinker` directory:
   ```env
   # WalletConnect Project ID (get from https://cloud.reown.com)
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

   # Alchemy API Key for Polygon (get from https://www.alchemy.com)
   NEXT_PUBLIC_ALCHEMY_API_KEY=https://polygon-mainnet.g.alchemy.com/v2/your_api_key

   # Pinata API Keys (get from https://pinata.cloud)
   NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token
   NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/

   # Optional: For Account Abstraction (Phase 3)
   NEXT_PUBLIC_BICONOMY_API_KEY=your_biconomy_api_key
   NEXT_PUBLIC_BICONOMY_BUNDLER_URL=https://bundler.biconomy.io/api/v2/137/your_api_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage Guide

### Connecting Your Wallet
1. Click "Connect Wallet" button
2. Select your wallet (MetaMask, etc.)
3. Approve the connection
4. Sign the XMTP initialization message

### Starting a Conversation
1. Enter a wallet address (0x...) or ENS name (name.eth) in the "New Chat" input
2. Click the "+" button or press Enter
3. The conversation will appear in your contact list

### Sending Messages
- Type your message and press Enter or click "Send"
- Messages are automatically encrypted end-to-end

### File Sharing
1. Click the 📎 icon in the message input
2. Select a file
3. The file will be encrypted and uploaded to IPFS
4. A link will be sent to your conversation partner

### In-Chat Payments
1. Open a conversation
2. Click the "💰 Pay" button
3. Enter the amount in MATIC
4. Confirm the transaction in your wallet

### Token Swaps
Type a command in the chat:
```
/swap 1 ETH USDC
```
This will show a swap quote and allow you to confirm the transaction.

### Video Calls
1. Open a conversation
2. Click the "📹 Video Call" button
3. Allow camera/microphone permissions
4. The call will be established via WebRTC

### Token-Gated Groups
Groups can be created with access rules:
- **NFT Gating**: Require ownership of a specific NFT
- **Token Gating**: Require a minimum balance of a token

## 🏗️ Project Structure

```
metalinker/
├── app/
│   ├── components/
│   │   ├── Messenger.js          # Main messenger component
│   │   ├── TokenGatedGroup.js    # Token-gated group component
│   │   └── VideoCall.js          # WebRTC video call component
│   ├── utils/
│   │   ├── ens.js                # ENS resolution utilities
│   │   ├── ipfs.js               # IPFS file handling
│   │   ├── token-gating.js       # Token/NFT balance checks
│   │   ├── payments.js           # Payment utilities
│   │   ├── swap.js               # Swap command parsing
│   │   └── xmtp-signer.js       # XMTP signer adapter
│   ├── providers.js              # Wagmi/Web3Modal providers
│   ├── page-client.js            # Client-side page wrapper
│   └── page.js                   # Server-side page
├── .env.local                    # Environment variables (create this)
└── package.json
```

## 🔐 Security Notes

- All messages are end-to-end encrypted via XMTP
- Files are encrypted before uploading to IPFS
- Private keys never leave your wallet
- Video calls use WebRTC (peer-to-peer encryption)

## 🚧 Roadmap

### Phase 3 Enhancements (In Progress)
- [ ] Account Abstraction integration (Biconomy/Pimlico)
- [ ] Paymaster for sponsored transactions
- [ ] Social login (Google, etc.) with smart contract wallets
- [ ] Farcaster Protocol integration for social graph

## 📝 Development Notes

- XMTP environment: Currently set to `production`. Change to `dev` in `Messenger.js` for testing
- Chain: Polygon Mainnet (137). Change in `providers.js` if needed
- File encryption: Currently basic. Enhance in `utils/ipfs.js` for production

## 🤝 Contributing

This is a development project. Feel free to submit issues and pull requests.

## 📄 License

MIT

## 🙏 Acknowledgments

- XMTP for the messaging protocol
- Pinata for IPFS infrastructure
- Wagmi and Web3Modal teams
- Polygon for the blockchain infrastructure
