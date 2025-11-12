"use client";
import React from "react";

// Wagmi (v2) / Web3Modal (v5) Imports
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
let projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
if (!projectId && typeof window !== "undefined") {
  // Only show alert in browser
  console.warn("Please add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to .env.local");
}

// 3. Create WAGMI config
const metadata = {
  name: "Web3 Messenger",
  description: "A decentralized messaging network",
  url: "http://localhost:3000", // Your local dev URL
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

const chains = [polygon];
const wagmiConfig = createConfig({
  chains,
  transports: {
    // Use the Alchemy API key from .env.local, or fallback to public RPC
    [polygon.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'https://polygon-rpc.com'),
  },
  projectId: projectId || 'default-project-id', // Fallback to prevent errors
  metadata,
});

// 4. Create Web3Modal (only if projectId exists)
if (projectId && projectId !== 'default-project-id') {
  createWeb3Modal({ wagmiConfig, projectId, chains });
}

// 5. Create the main Providers component
export function Providers({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <XmtpProviderWrapper>{children}</XmtpProviderWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}