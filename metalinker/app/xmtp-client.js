"use client";

import React, { useEffect, useState } from "react";
import { Client } from "@xmtp/browser-sdk";
import { getAddress, isAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { createXmtpSignerFromWalletClient } from "./utils/xmtp-signer";
import { buildEthereumIdentifier, messageToDate } from "./utils/xmtp";

export default function XmtpClient() {
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [peerAddress, setPeerAddress] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!walletClient || !isConnected) {
      setClient(null);
      setStatus("idle");
      setConversation(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    let xmtpClient = null;

    (async () => {
      try {
        setStatus("initializing");
        setError(null);

        xmtpClient = await Client.create(
          createXmtpSignerFromWalletClient(walletClient),
          { env: "dev" }
        );

        if (cancelled) {
          xmtpClient.close();
          return;
        }

        setClient(xmtpClient);
        setStatus("ready");
      } catch (err) {
        console.error("XMTP Init Error:", err);

        if (!cancelled) {
          setError(err?.message ?? String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      xmtpClient?.close();
    };
  }, [walletClient, isConnected]);

  const handleStartConversation = async () => {
    if (!client || !isAddress(peerAddress)) {
      setError("Enter a valid wallet address.");
      return;
    }

    try {
      const identifier = buildEthereumIdentifier(getAddress(peerAddress));
      const convo = await client.conversations.newDmWithIdentifier(identifier);
      setConversation(convo);
      setMessages(await convo.messages());
    } catch (err) {
      console.error("Conversation error:", err);
      setError(err?.message ?? String(err));
    }
  };

  const handleSendMessage = async () => {
    if (!conversation || !message.trim()) {
      return;
    }

    try {
      await conversation.send(message);
      setMessage("");
      setMessages(await conversation.messages());
    } catch (err) {
      console.error("Send message error:", err);
      setError(err?.message ?? String(err));
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl mb-4 text-indigo-400 font-bold">XMTP Messenger</h1>

      {status === "idle" && <p>Connect wallet to start.</p>}
      {status === "initializing" && <p>Initializing XMTP client...</p>}
      {status === "error" && <p className="text-red-400">Error: {error}</p>}
      {status === "ready" && (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={peerAddress}
              onChange={(event) => setPeerAddress(event.target.value)}
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
                Chatting with {getAddress(peerAddress)}
              </h3>
              <div className="h-64 overflow-y-auto border border-gray-700 p-3 rounded mb-3 bg-gray-800">
                {messages.map((item) => {
                  const sentAt = messageToDate(item);

                  return (
                    <div key={item.id} className="mb-2 p-2 rounded bg-gray-700">
                      <p>{typeof item.content === "string" ? item.content : String(item.content)}</p>
                      {sentAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          {sentAt.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
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
