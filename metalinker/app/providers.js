"use client";

import React from "react";

// --- Wagmi v1 Imports ---
import { createWeb3Modal, defaultWagmiConfig } from "@web3modal/wagmi/react";
import { WagmiConfig } from "wagmi";
// We no longer import any chain from wagmi/chains or viem/chains
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";

// --- XMTP Import ---
const XmtpProviderWrapper = dynamic(
  () => import("./xmtp-provider-wrapper"),
  { ssr: false } // No Server-Side Rendering.
);

const queryClient = new QueryClient();

// --- 1. MANUALLY DEFINE POLYGON AMOY ---
// This is the fix, because Wagmi v1 doesn't know about Amoy.
const polygonAmoy = {
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-amoy.polygon.technology/"] },
    public: { http: ["https://rpc-amoy.polygon.technology/"] },
  },
  blockExplorers: {
    default: { name: "Amoy PolygonScan", url: "https://amoy.polygonscan.com" },
  },
  testnet: true,
};
// --- END OF FIX ---

// 2. Get your Project ID from https://cloud.walletconnect.com
let projectId = "10ee6ea02a86486f499e6d7ca094d2b8"; // Get this from https://cloud.walletconnect.com/
if (!projectId || projectId === "10ee6ea02a86486f499e6d7ca094d2b8") {
  // Try to get it from environment variables
  const envProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (envProjectId) {
    projectId = envProjectId;
  } else {
    // Fallback alert for development
    alert("Please add YOUR_WALLETCONNECT_PROJECT_ID to app/providers.js");
    throw new Error("YOUR_WALLETCONNECT_PROJECT_ID is not set in providers.js");
  }
}

const metadata = {
  name: "Web3 Messenger",
  description: "A decentralized, user-owned messaging network",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

// 3. Use our manually defined chain
const chains = [polygonAmoy];

// 4. Create Wagmi v1 config
const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// 5. Create Web3Modal
createWeb3Modal({ wagmiConfig, projectId, chains });

// 6. Main Providers Component
export function Providers({ children }) {
  return (
    // v1 uses <WagmiConfig>
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <XmtpProviderWrapper>{children}</XmtpProviderWrapper>
      </QueryClientProvider>
    </WagmiConfig>
  );
}