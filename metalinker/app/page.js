// app/page.js
import dynamic from "next/dynamic";
import React from "react";

// Dynamically import the client chat UI (no server-side rendering)
const PageClient = dynamic(() => import("./page-client"), { ssr: false });

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header (server-safe) */}
      <header className="bg-gray-800 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-400">Web3 Messenger</h1>
          <div /> {/* wallet button rendered client-side */}
        </div>
      </header>

      {/* Client-only content */}
      <main className="flex-grow">
        <PageClient />
      </main>
    </div>
  );
}
