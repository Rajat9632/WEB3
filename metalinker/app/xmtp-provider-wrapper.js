"use client";

// This file is a simple wrapper component.
// Its only job is to be a "use client" boundary
// for the XMTPProvider, which has issues with Server-Side Rendering (SSR).

import { XMTPProvider } from "@xmtp/react-sdk";
import React from "react";

export default function XmtpProviderWrapper({ children }) {
  return <XMTPProvider>{children}</XMTPProvider>;
}