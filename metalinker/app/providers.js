"use client";
import React, { useEffect } from "react";

// Reown AppKit (replacement for deprecated @web3modal/wagmi)
import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider, http } from "wagmi";
import { mainnet, polygon } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

// XMTP Import
import dynamic from "next/dynamic";

// Dynamically load the XMTP provider wrapper to prevent SSR issues
const XmtpProviderWrapper = dynamic(
  () => import("./xmtp-provider-wrapper"),
  { ssr: false }
);

// 1. Create a QueryClient
const queryClient = new QueryClient();

// 2. Get Project ID
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
if (!projectId && typeof window !== "undefined") {
  console.warn("Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to .env.local");
}

// 3. App metadata
const metadata = {
  name: "Web3 Messenger",
  description: "A decentralized messaging network",
  url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

// 4. Helper function to get Polygon RPC URL
const getPolygonRpcUrl = () => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  if (apiKey && (apiKey.startsWith('http://') || apiKey.startsWith('https://'))) {
    return apiKey;
  }

  if (apiKey && !apiKey.includes('://')) {
    return `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  return 'https://polygon-rpc.com';
};

// 5. Set up networks
const networks = [mainnet, polygon];

// 6. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: projectId || "default-project-id",
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(getPolygonRpcUrl()),
  },
});

let hasInitializedAppKit = false;

function initializeAppKit() {
  if (!projectId || projectId === "default-project-id" || hasInitializedAppKit) {
    return;
  }

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    featuredWalletIds: [
      "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
    ],
    features: {
      analytics: false,
    },
  });

  hasInitializedAppKit = true;
}

// 8. Create the main Providers component
export function Providers({ children }) {
  useEffect(() => {
    initializeAppKit();
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <XmtpProviderWrapper>{children}</XmtpProviderWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
