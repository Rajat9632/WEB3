// app/page.js
import dynamic from "next/dynamic";
import React from "react";

// Dynamically import the client chat UI (no server-side rendering)
const PageClient = dynamic(() => import("./page-client"), { ssr: false });

export default function Page() {
  return <PageClient />;
}
