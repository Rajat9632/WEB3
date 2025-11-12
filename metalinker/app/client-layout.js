"use client"; // <-- This is the key. This is now a Client Component.

import dynamic from "next/dynamic";
import React from "react";

// --- DYNAMICALLY LOAD PROVIDERS HERE ---
// This is where 'ssr: false' is allowed, because this
// is a Client Component.
const ClientProviders = dynamic(
  () => import("./providers").then((mod) => mod.Providers),
  {
    ssr: false,
  }
);

export default function ClientLayout({ children }) {
  // Render the dynamically loaded Providers, passing the children through
  return <ClientProviders>{children}</ClientProviders>;
}