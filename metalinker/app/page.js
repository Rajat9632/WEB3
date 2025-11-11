"use client";

import React, { useState } from "react";
// --- FIX: Import useWalletClient ---
import { useAccount, useWalletClient } from "wagmi";
import {
  // Primary XMTP Hooks
  useClient,
  useConversations,
  useMessages,
  useStreamMessages,
  useSendMessage,
  // XMTP Utility Hooks
  Client,
  SortDirection,
} from "@xmtp/react-sdk";

// --- 1. Top-Level Components ---

export default function Home() {
  console.log("--- DEBUG: 1. Home component rendering ---");
  const { isConnected, address } = useAccount();
  console.log(
    `--- DEBUG: 2. Wallet Status: isConnected= ${isConnected}, address= ${address}`
  );

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-indigo-400">Web3 Messenger</h1>
        {/* Use Web3Modal's connect button */}
        <w3m-button />
      </header>

      {/* Main App Body */}
      <div className="flex-grow overflow-hidden">
        {isConnected && address ? (
          <>
            <XMTPClientHandler address={address} />
            <ChatApp />
          </>
        ) : (
          <div className="flex justify-center items-center h-full">
            <h2 className="text-2xl text-gray-400">
              Please connect your wallet to start messaging.
            </h2>
          </div>
        )}
      </div>
    </div>
  );
}

function XMTPClientHandler({ address }) {
  console.log("--- DEBUG: 3. XMTPClientHandler component rendering ---");
  const { client, initialize, status } = useClient();
  // --- FIX: Get the wagmi walletClient (the signer) ---
  const { data: walletClient } = useWalletClient();
  console.log(
    `--- DEBUG: 4. XMTP Status: clientExists= ${!!client}, status= ${status}, walletClientExists= ${!!walletClient}`
  );

  // Check if client is initialized
  if (!client && status !== "pending" && address) {
    console.log("--- DEBUG: 5. Rendering the 'Initialize' button ---");
    // This is the "init" button.
    return (
      <div className="flex justify-center items-center h-full">
        <button
          // --- FIX: Make the onClick async ---
          onClick={async () => {
            console.log("--- DEBUG: 6. BUTTON CLICKED! ---");

            if (!walletClient) {
              console.error(
                "--- DEBUG: 8. ERROR: Wallet client not found! ---"
              );
              alert("Wallet client not found. Please reconnect your wallet.");
              return;
            }

            try {
              console.log(
                "--- DEBUG: 7. Calling initialize() WITH walletClient... ---"
              );
              // --- FIX: Pass the signer explicitly ---
              await initialize({
                signer: walletClient, // This tells XMTP *which* wallet to use
                env: "dev",
              });
              console.log("--- DEBUG: 9. initialize() function finished. ---");
            } catch (e) {
              console.error("--- DEBUG: 10. ERROR during initialize() ---", e);
            }
          }}
          className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500"
        >
          {status === "pending" ? "Loading..." : "Initialize XMTP Client"}
        </button>
      </div>
    );
  }

  console.log(
    "--- DEBUG: 5b. Client is ready or pending. Not rendering button. ---"
  );
  // Client is initialized, so we don't need to render anything.
  return null;
}

// --- 2. Main Chat Application UI ---

function ChatApp() {
  console.log("--- DEBUG: 9. ChatApp component rendering ---");
  const { client } = useClient();
  const [selectedConversation, setSelectedConversation] = useState(null);

  if (!client) {
    console.log("--- DEBUG: 10. ChatApp waiting for client... ---");
    return null;
  }

  console.log("--- DEBUG: 11. ChatApp client is ready. Rendering UI. ---");
  return (
    <div className="flex h-full">
      {/* Panel 1: Conversation List */}
      <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
        <ConversationList
          onSelectConversation={setSelectedConversation}
          client={client}
        />
      </div>

      {/* Panel 2: Chat Window */}
      <div className="w-2/3 flex flex-col">
        {selectedConversation ? (
          <ChatWindow conversation={selectedConversation} />
        ) : (
          <div className="flex justify-center items-center h-full text-gray-500">
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

// --- 3. Chat Components ---

function ConversationList({ onSelectConversation, client }) {
  const { conversations, isLoading, error } = useConversations();

  // --- THIS IS THE FIX ---
  const [newAddress, setNewAddress] = useState(""); // Removed the extra '='
  // --- END OF FIX ---

  const [isStarting, setIsStarting] = useState(false);

  const startNewConversation = async () => {
    if (isStarting || !newAddress || !Client.isValidAddress(newAddress)) {
      alert("Invalid wallet address. Make sure it starts with 0x...");
      return;
    }
    setIsStarting(true);
    try {
      // Check if this address is on the XMTP network
      const canMessage = await client.canMessage(newAddress);
      if (!canMessage) {
        alert(
          "This address is not on the XMTP network. They must initialize their client first."
        );
        setIsStarting(false);
        return;
      }

      // Create the new conversation
      const newConversation = await client.conversations.newConversation(
        newAddress
      );
      onSelectConversation(newConversation);
      setNewAddress("");
    } catch (error) {
      console.error("Failed to start new conversation:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  if (error) {
    return (
      <div className="p-4 text-red-400">
        Error loading conversations: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4">Loading conversations...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Conversation Input */}
      <div className="p-4 border-b border-gray-700">
        <input
          type="text"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
          placeholder="Enter a 0x... wallet address"
          className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-white"
        />
        <button
          onClick={startNewConversation}
          disabled={isStarting}
          className="w-full mt-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:bg-gray-500"
        >
          {isStarting ? "Starting..." : "New Chat"}
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-grow overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-gray-500">No conversations yet.</p>
        )}
        {conversations.map((convo) => (
          <div
            key={convo.topic}
            onClick={() => onSelectConversation(convo)}
            className="p-4 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
          >
            {/* Truncate the peer address for display */}
            <p className="font-bold">
              {convo.peerAddress.slice(0, 6)}...{convo.peerAddress.slice(-4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatWindow({ conversation }) {
  const { address } = useAccount();
  const { messages, isLoading, error } = useMessages({
    conversation,
    // We want the most recent messages first
    sortDirection: SortDirection.DESCENDING,
    // We'll limit to 50 messages for performance
    limit: 50,
  });

  // This hook will automatically add new messages to the `messages` array
  useStreamMessages({ conversation });

  const { sendMessage, isSending } = useSendMessage();
  const [messageText, setMessageText] = useState("");

  const handleSend = async () => {
    if (!messageText || isSending) return;
    try {
      await sendMessage(messageText);
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(`Error: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center items-center h-full">
        Loading messages...
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-red-400">
        {/* --- THIS IS THE SECOND FIX --- */}
        Error loading messages: {error.message}
        {/* --- END OF FIX --- */}
      </div>
    );
  }

  // We reverse the messages so they appear in chronological order (oldest at top)
  const reversedMessages = [...messages].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h3 className="font-bold">
          {conversation.peerAddress.slice(0, 6)}...
          {conversation.peerAddress.slice(-4)}
        </h3>
      </div>

      {/* Message List */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {reversedMessages.map((msg) => {
          const isSender = msg.senderAddress === address;
          return (
            <div
              key={msg.id}
              className={`flex ${isSender ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-4 py-2 rounded-lg max-w-xs lg:max-w-md ${
                  isSender ? "bg-indigo-600" : "bg-gray-700"
                }`}
              >
                {/* This is where you'd add logic to render different
                  content types (e.g., images, if msg.contentType is not text)
                */}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Input Box */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 flex">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !isSending) {
              handleSend();
            }
          }}
          placeholder="Type your message..."
          className="flex-grow p-2 bg-gray-700 rounded-l-lg border border-gray-600 text-white"
        />
        <button
          onClick={handleSend}
          disabled={isSending}
          className="px-4 py-2 bg-indigo-600 rounded-r-lg hover:bg-indigo-500 disabled:bg-gray-500"
        >
          {isSending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}