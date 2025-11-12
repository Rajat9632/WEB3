"use client";

import React, { useState, useEffect } from "react";
import { Client } from "@xmtp/browser-sdk";
import { useWalletClient, useAccount } from "wagmi";

export default function XmtpClient() {
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [peerAddress, setPeerAddress] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!walletClient || !isConnected) return;
    (async () => {
      try {
        setStatus("initializing");
        const xmtp = await Client.create(walletClient, { env: "dev" }); // 'production' for mainnet
        console.log("✅ XMTP Client Ready:", xmtp);
        setClient(xmtp);
        setStatus("ready");
      } catch (e) {
        console.error("XMTP Init Error:", e);
        setError(e.message);
        setStatus("error");
      }
    })();
  }, [walletClient, isConnected]);

  const handleStartConversation = async () => {
    if (!client || !peerAddress) return;
    try {
      const convo = await client.conversations.newConversation(peerAddress);
      setConversation(convo);

      // load previous messages
      const msgs = await convo.messages();
      setMessages(msgs);
    } catch (e) {
      console.error("Conversation error:", e);
    }
  };

  const handleSendMessage = async () => {
    if (!conversation || !message) return;
    await conversation.send(message);
    setMessage("");
    const msgs = await conversation.messages();
    setMessages(msgs);
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl mb-4 text-indigo-400 font-bold">XMTP V3 Messenger</h1>

      {status === "idle" && <p>Connect wallet to start.</p>}
      {status === "initializing" && <p>Initializing XMTP Client...</p>}
      {status === "error" && <p className="text-red-400">Error: {error}</p>}
      {status === "ready" && (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={peerAddress}
              onChange={(e) => setPeerAddress(e.target.value)}
              placeholder="Enter wallet address (0x...)"
              className="p-2 rounded bg-gray-700 w-full mb-2"
            />
            <button
              onClick={handleStartConversation}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded font-bold"
            >
              Start Conversation
            </button>
          </div>

          {conversation && (
            <div className="mt-6">
              <h3 className="font-semibold text-lg mb-2">
                Chatting with {conversation.peerAddress}
              </h3>
              <div className="h-64 overflow-y-auto border border-gray-700 p-3 rounded mb-3 bg-gray-800">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`mb-2 p-2 rounded ${
                      m.senderAddress === address
                        ? "bg-indigo-600 self-end text-right"
                        : "bg-gray-700 self-start"
                    }`}
                  >
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type message..."
                  className="flex-grow p-2 rounded-l bg-gray-700"
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-indigo-600 hover:bg-indigo-700 px-4 rounded-r"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
