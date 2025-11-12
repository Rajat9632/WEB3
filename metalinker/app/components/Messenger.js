"use client";

import React, { useEffect, useState, useRef } from "react";
import { Client } from "@xmtp/browser-sdk";
import { useWalletClient, useAccount, useDisconnect, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { parseEther } from "viem";
import { resolveENS, reverseResolveENS } from "../utils/ens";
import { uploadToIPFS, downloadFromIPFS, extractIPFSHash } from "../utils/ipfs";
import { checkNFTBalance, checkTokenBalance, createGroupRules } from "../utils/token-gating";
import { parseSwapCommand, getSwapQuote } from "../utils/swap";
import { createXmtpSignerFromWalletClient } from "../utils/xmtp-signer";
import VideoCall from "./VideoCall";

export default function Messenger() {
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  
  // Handle connect button click
  const handleConnect = async () => {
    try {
      await open();
    } catch (error) {
      console.error("Error opening Web3Modal:", error);
      // Fallback: try to connect directly via MetaMask if Web3Modal fails
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
        } catch (e) {
          console.error("Error connecting to MetaMask:", e);
          alert("Failed to connect wallet. Please make sure MetaMask is installed and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set in .env.local");
        }
      } else {
        alert("Please install MetaMask or set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local");
      }
    }
  };
  const { sendTransaction, data: txHash, isPending: isSendingTx } = useSendTransaction();
  const { isLoading: isConfirmingTx, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // XMTP State
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [newChatAddress, setNewChatAddress] = useState("");
  const [isResolvingENS, setIsResolvingENS] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [swapQuote, setSwapQuote] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRecipient, setPaymentRecipient] = useState("");
  const [showVideoCall, setShowVideoCall] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize XMTP Client
  useEffect(() => {
    if (!walletClient || !isConnected) return;

    let cancelled = false;
    let messageStream = null;

    (async () => {
      setStatus("initializing");
      setError(null);
      try {
        // Use 'dev' for testing, 'production' for mainnet
        // IMPORTANT: Users on 'dev' can only message other 'dev' users
        const xmtpEnv = process.env.NEXT_PUBLIC_XMTP_ENV || "dev";
        console.log("Initializing XMTP with environment:", xmtpEnv);
        console.log("Make sure you SIGN the message in your wallet when prompted!");
        
        // Verify walletClient is valid
        if (!walletClient) {
          throw new Error("Wallet client not available. Please connect your wallet first.");
        }
        
        // Try walletClient directly first (simpler, might work better)
        let xmtp;
        try {
          console.log("🔄 Attempting to use walletClient directly (simpler approach)...");
          xmtp = await Client.create(walletClient, { env: xmtpEnv });
          console.log("✅ XMTP client created successfully with walletClient directly!");
        } catch (directError) {
          console.warn("⚠️ Direct walletClient approach failed, trying custom signer...", directError);
          
          // Fallback to custom signer
          const signer = createXmtpSignerFromWalletClient(walletClient);
          
          if (!signer) {
            throw new Error("Failed to create signer. Please check wallet connection.");
          }
          
          if (!signer.getIdentifier || typeof signer.getIdentifier !== 'function') {
            throw new Error("Signer missing getIdentifier method. Please check wallet connection.");
          }
          if (!signer.signMessage || typeof signer.signMessage !== 'function') {
            throw new Error("Signer missing signMessage method. Please check wallet connection.");
          }
          
          console.log("Signer created successfully, initializing XMTP client...");
          xmtp = await Client.create(signer, { env: xmtpEnv });
        }
        
        if (cancelled) {
          try { await xmtp.shutdown?.(); } catch {}
          return;
        }

        setClient(xmtp);
        setStatus("ready");

        // Load existing conversations
        const convos = await xmtp.conversations.list();
        setConversations(convos);

        // Set up real-time message streaming
        messageStream = await xmtp.conversations.stream();
        (async () => {
          for await (const conversation of messageStream) {
            if (cancelled) break;
            
            // Update conversations list
            setConversations((prev) => {
              const exists = prev.find((c) => c.topic === conversation.topic);
              if (exists) return prev;
              return [...prev, conversation];
            });

            // If this is the selected conversation, refresh messages
            if (selectedConversation?.topic === conversation.topic) {
              const msgs = await conversation.messages();
              setMessages(msgs || []);
            }
          }
        })();
      } catch (err) {
        console.error("Error initializing XMTP client:", err);
        setError(err?.message ?? String(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (messageStream) {
        messageStream.return?.();
      }
    };
  }, [walletClient, isConnected]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      try {
        const msgs = await selectedConversation.messages();
        setMessages(msgs || []);
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    loadMessages();

    // Set up real-time message listener for this conversation
    let messageStream = null;
    (async () => {
      try {
        messageStream = await selectedConversation.streamMessages();
        for await (const message of messageStream) {
          setMessages((prev) => {
            // Avoid duplicates
            const exists = prev.find((m) => m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
      } catch (err) {
        console.error("Error streaming messages:", err);
      }
    })();

    return () => {
      if (messageStream) {
        messageStream.return?.();
      }
    };
  }, [selectedConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start new conversation with ENS resolution
  const startConversation = async () => {
    if (!client || !newChatAddress.trim()) return;

    setIsResolvingENS(true);
    try {
      let resolvedAddress = newChatAddress.trim();
      
      // Check if it's an ENS name
      if (resolvedAddress.endsWith(".eth")) {
        resolvedAddress = await resolveENS(resolvedAddress);
        if (!resolvedAddress || resolvedAddress === newChatAddress.trim()) {
          setError("Failed to resolve ENS name");
          setIsResolvingENS(false);
          return;
        }
      }

      // Check if address is valid
      if (!resolvedAddress.startsWith("0x") || resolvedAddress.length !== 42) {
        setError("Invalid address");
        setIsResolvingENS(false);
        return;
      }

      // Create or get conversation
      const convo = await client.conversations.newConversation(resolvedAddress);
      setSelectedConversation(convo);
      setNewChatAddress("");
      
      // Add to conversations if not already there
      setConversations((prev) => {
        const exists = prev.find((c) => c.topic === convo.topic);
        if (exists) return prev;
        return [...prev, convo];
      });
    } catch (err) {
      console.error("startConversation error:", err);
      setError(String(err));
    } finally {
      setIsResolvingENS(false);
    }
  };

  // Send message with file support and swap command parsing
  const sendMessage = async () => {
    if (!selectedConversation || (!messageText.trim() && !attachedFile)) return;

    try {
      // Check for swap command
      const swapParams = parseSwapCommand(messageText);
      if (swapParams) {
        const quote = await getSwapQuote(
          swapParams.amount,
          swapParams.fromToken,
          swapParams.toToken
        );
        setSwapQuote({ ...swapParams, quote });
        // Don't send the message yet, wait for user confirmation
        return;
      }

      // Handle file attachment
      if (attachedFile) {
        const ipfsHash = await uploadToIPFS(attachedFile, client);
        await selectedConversation.send(`File: ${ipfsHash}`);
        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        await selectedConversation.send(messageText);
      }

      setMessageText("");
      
      // Refresh messages
      const msgs = await selectedConversation.messages();
      setMessages(msgs || []);
    } catch (err) {
      console.error("sendMessage error:", err);
      setError(String(err));
    }
  };

  // Confirm swap transaction
  const confirmSwap = async () => {
    if (!swapQuote || !walletClient) return;
    
    try {
      // In production, this would construct and send the actual swap transaction
      // For now, we'll just send a message confirming the swap
      await selectedConversation.send(
        `Swap confirmed: ${swapQuote.amount} ${swapQuote.fromToken} -> ${swapQuote.quote.amountOut} ${swapQuote.toToken}`
      );
      setSwapQuote(null);
      setMessageText("");
    } catch (err) {
      console.error("Swap confirmation error:", err);
    }
  };

  // Send payment
  const sendPayment = async () => {
    if (!paymentAmount || !paymentRecipient) return;

    try {
      const amount = parseEther(paymentAmount);
      await sendTransaction({
        to: paymentRecipient,
        value: amount,
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentRecipient("");
    } catch (err) {
      console.error("Payment error:", err);
      setError(String(err));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  // Format address for display
  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Get display name for conversation
  const getConversationName = async (conversation) => {
    const peerAddress = conversation.peerAddress || conversation.peerAccountAddress;
    try {
      const ensName = await reverseResolveENS(peerAddress);
      return ensName.endsWith(".eth") ? ensName : formatAddress(peerAddress);
    } catch {
      return formatAddress(peerAddress);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-md border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-400">Web3 Messenger</h1>
          <div className="flex items-center gap-4">
            {isConnected && address && (
              <span className="text-sm text-gray-400">{formatAddress(address)}</span>
            )}
            {isConnected ? (
              <button
                onClick={() => disconnect()}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex overflow-hidden">
        {!isConnected ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl text-gray-400 mb-4">Please connect your wallet to begin</p>
              <button
                onClick={handleConnect}
                className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        ) : status === "initializing" ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-lg">Initializing XMTP (confirm signature)…</p>
          </div>
        ) : status === "error" ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-lg text-red-400">Error: {error}</p>
          </div>
        ) : status === "ready" ? (
          <>
            {/* Contact List Panel */}
            <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold mb-3">Conversations</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChatAddress}
                    onChange={(e) => setNewChatAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && startConversation()}
                    placeholder="Address or .eth name"
                    className="flex-1 p-2 rounded bg-gray-700 text-sm"
                  />
                  <button
                    onClick={startConversation}
                    disabled={isResolvingENS || !newChatAddress.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded text-sm"
                  >
                    {isResolvingENS ? "..." : "+"}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No conversations yet. Start a new chat!
                  </div>
                ) : (
                  conversations.map((convo) => (
                    <button
                      key={convo.topic}
                      onClick={() => setSelectedConversation(convo)}
                      className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-700 ${
                        selectedConversation?.topic === convo.topic ? "bg-gray-700" : ""
                      }`}
                    >
                      <div className="font-medium">
                        {formatAddress(convo.peerAddress || convo.peerAccountAddress)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-gray-900">
              {!selectedConversation ? (
                <div className="flex-grow flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <p className="text-lg">Select or create a conversation to start chatting</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">
                        {formatAddress(selectedConversation.peerAddress || selectedConversation.peerAccountAddress)}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowPaymentModal(true);
                          setPaymentRecipient(selectedConversation.peerAddress || selectedConversation.peerAccountAddress);
                        }}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm"
                      >
                        💰 Pay
                      </button>
                      <button
                        onClick={() => setShowVideoCall(true)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                      >
                        📹 Video Call
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500">No messages yet.</div>
                    ) : (
                      messages.map((m) => {
                        const isMe = m.senderAddress === address;
                        const ipfsHash = extractIPFSHash(m.content);
                        const isFile = m.content.startsWith("File: ipfs://");

                        return (
                          <div
                            key={m.id || m.sent}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                isMe
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-700 text-gray-100"
                              }`}
                            >
                              {isFile && ipfsHash ? (
                                <div>
                                  <p className="text-sm mb-2">📎 File attachment</p>
                                  <a
                                    href={`${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs/"}${ipfsHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs underline"
                                  >
                                    View on IPFS
                                  </a>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              )}
                              <p className="text-xs opacity-70 mt-1">
                                {new Date(m.sent).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Swap Quote Modal */}
                  {swapQuote && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Confirm Swap</h3>
                        <div className="space-y-2 mb-4">
                          <p>
                            Swap {swapQuote.amount} {swapQuote.fromToken} for{" "}
                            {swapQuote.quote?.amountOut} {swapQuote.toToken}
                          </p>
                          <p className="text-sm text-gray-400">
                            Price Impact: {swapQuote.quote?.priceImpact}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSwapQuote(null)}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={confirmSwap}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Call */}
                  {showVideoCall && (
                    <VideoCall
                      conversation={selectedConversation}
                      xmtpClient={client}
                      onClose={() => setShowVideoCall(false)}
                    />
                  )}

                  {/* Payment Modal */}
                  {showPaymentModal && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Send Payment</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm mb-1">Recipient</label>
                            <input
                              type="text"
                              value={paymentRecipient}
                              onChange={(e) => setPaymentRecipient(e.target.value)}
                              className="w-full p-2 rounded bg-gray-700"
                              placeholder="0x..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Amount (MATIC)</label>
                            <input
                              type="number"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              className="w-full p-2 rounded bg-gray-700"
                              placeholder="0.0"
                              step="0.001"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              setShowPaymentModal(false);
                              setPaymentAmount("");
                              setPaymentRecipient("");
                            }}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={sendPayment}
                            disabled={isSendingTx || isConfirmingTx || !paymentAmount || !paymentRecipient}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
                          >
                            {isSendingTx || isConfirmingTx ? "Processing..." : "Send"}
                          </button>
                        </div>
                        {isTxSuccess && (
                          <p className="text-green-400 text-sm mt-2">Payment sent successfully!</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="bg-gray-800 p-4 border-t border-gray-700">
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-input"
                      />
                      <label
                        htmlFor="file-input"
                        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded cursor-pointer"
                      >
                        📎
                      </label>
                      {attachedFile && (
                        <span className="text-sm text-gray-400 self-center">
                          {attachedFile.name}
                        </span>
                      )}
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Type a message... (or /swap 1 ETH USDC)"
                        className="flex-1 p-2 rounded bg-gray-700"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!messageText.trim() && !attachedFile}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-2 rounded"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

