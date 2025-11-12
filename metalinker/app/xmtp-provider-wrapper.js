"use client";

import React from "react";

// XMTP Provider Wrapper - No longer needed with @xmtp/browser-sdk
// We handle XMTP client creation directly in components
export default function XmtpProviderWrapper({ children }) {
  return <>{children}</>;
}