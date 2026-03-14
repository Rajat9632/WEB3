"use client";

import React, { useEffect, useRef, useState } from "react";
import { Client } from "@xmtp/browser-sdk";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, isAddress, parseEther } from "viem";
import { resolveENS } from "../utils/ens";
import { extractIPFSHash, uploadToIPFS } from "../utils/ipfs";
import { getSwapQuote, parseSwapCommand } from "../utils/swap";
import {
  buildEthereumIdentifier,
  messageToDate,
  resolveDmPeerAddress,
} from "../utils/xmtp";
import { createXmtpSignerFromWalletClient } from "../utils/xmtp-signer";
import VideoCall from "./VideoCall";

function useOptionalAppKit() {
  try {
    return useAppKit();
  } catch {
    return null;
  }
}

export default function Messenger() {
  const { data: walletClient } = useWalletClient();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnectingWallet } = useConnect();
  const appKit = useOptionalAppKit();
  const { disconnect } = useDisconnect();
  const { sendTransaction, data: txHash, isPending: isSendingTx } = useSendTransaction();
  const { isLoading: isConfirmingTx, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const [client, setClient] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationAddresses, setConversationAddresses] = useState({});
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
  const selectedConversationRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const connectWithInjectedWallet = async () => {
    const connector =
      connectors.find(
        (item) =>
          item.id === "metaMask" ||
          item.id === "injected" ||
          item.type === "injected"
      ) ?? connectors[0];

    if (!connector) {
      throw new Error("No wallet connector is available.");
    }

    await connectAsync({ connector });
  };

  const handleConnect = async () => {
    setError(null);

    try {
      if (appKit) {
        await appKit.open();
        return;
      }

      await connectWithInjectedWallet();
    } catch (openError) {
      console.error("Wallet modal connection failed:", openError);

      try {
        await connectWithInjectedWallet();
      } catch (connectError) {
        console.error("Injected wallet connection failed:", connectError);
        setError(
          typeof window !== "undefined" && window.ethereum
            ? "Failed to connect wallet. Unlock MetaMask and try again."
            : "MetaMask is not installed and WalletConnect is not configured."
        );
      }
    }
  };

  useEffect(() => {
    if (walletClient && isConnected) {
      return;
    }

    setClient(null);
    setStatus("idle");
    setError(null);
    setConversations([]);
    setConversationAddresses({});
    setSelectedConversation(null);
    setMessages([]);
    setSwapQuote(null);
    setAttachedFile(null);
  }, [walletClient, isConnected]);

  useEffect(() => {
    if (!walletClient || !isConnected) {
      return;
    }

    let cancelled = false;
    let xmtpClient = null;
    let conversationStream = null;

    (async () => {
      setStatus("initializing");
      setError(null);

      try {
        const xmtpEnv = process.env.NEXT_PUBLIC_XMTP_ENV || "dev";
        const signer = createXmtpSignerFromWalletClient(walletClient);

        xmtpClient = await Client.create(signer, { env: xmtpEnv });

        if (cancelled) {
          xmtpClient.close();
          return;
        }

        await xmtpClient.conversations.sync();
        const nextConversations = await xmtpClient.conversations.list();

        if (cancelled) {
          xmtpClient.close();
          return;
        }

        setClient(xmtpClient);
        setStatus("ready");
        setConversations(nextConversations);

        conversationStream = await xmtpClient.conversations.stream();

        for await (const conversation of conversationStream) {
          if (cancelled) {
            break;
          }

          setConversations((prev) => {
            if (prev.some((item) => item.id === conversation.id)) {
              return prev;
            }

            return [conversation, ...prev];
          });

          if (selectedConversationRef.current?.id === conversation.id) {
            const nextMessages = await conversation.messages();

            if (!cancelled) {
              setMessages(nextMessages || []);
            }
          }
        }
      } catch (err) {
        console.error("Error initializing XMTP client:", err);

        if (!cancelled) {
          setClient(null);
          setError(err?.message ?? String(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      conversationStream?.return?.();
      xmtpClient?.close();
    };
  }, [walletClient, isConnected]);

  useEffect(() => {
    if (!client || conversations.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      for (const conversation of conversations) {
        if (conversationAddresses[conversation.id]) {
          continue;
        }

        try {
          const peerAddress = await resolveDmPeerAddress(client, conversation);

          if (!cancelled && peerAddress) {
            setConversationAddresses((prev) => {
              if (prev[conversation.id] === peerAddress) {
                return prev;
              }

              return {
                ...prev,
                [conversation.id]: peerAddress,
              };
            });
          }
        } catch (err) {
          console.error("Failed to resolve DM peer address:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, conversations, conversationAddresses]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    let messageStream = null;

    (async () => {
      try {
        const nextMessages = await selectedConversation.messages();

        if (!cancelled) {
          setMessages(nextMessages || []);
        }

        messageStream = await selectedConversation.stream();

        for await (const message of messageStream) {
          if (cancelled) {
            break;
          }

          setMessages((prev) => {
            if (prev.some((item) => item.id === message.id)) {
              return prev;
            }

            return [...prev, message];
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error streaming messages:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      messageStream?.return?.();
    };
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    if (!client || !newChatAddress.trim()) {
      return;
    }

    setIsResolvingENS(true);
    setError(null);

    try {
      let resolvedAddress = newChatAddress.trim();

      if (resolvedAddress.endsWith(".eth")) {
        resolvedAddress = await resolveENS(resolvedAddress);
      }

      if (!isAddress(resolvedAddress)) {
        throw new Error("Invalid address or ENS name");
      }

      const checksumAddress = getAddress(resolvedAddress);
      const identifier = buildEthereumIdentifier(checksumAddress);
      const canMessage = await client.canMessage([identifier]);
      const isReachable =
        canMessage.get(checksumAddress) ??
        canMessage.get(checksumAddress.toLowerCase());

      if (!isReachable) {
        throw new Error(
          `This wallet is not available on XMTP ${process.env.NEXT_PUBLIC_XMTP_ENV || "dev"}.`
        );
      }

      const conversation = await client.conversations.newDmWithIdentifier(identifier);

      setSelectedConversation(conversation);
      setNewChatAddress("");
      setConversations((prev) => {
        if (prev.some((item) => item.id === conversation.id)) {
          return prev;
        }

        return [conversation, ...prev];
      });
      setConversationAddresses((prev) => ({
        ...prev,
        [conversation.id]: checksumAddress,
      }));
    } catch (err) {
      console.error("startConversation error:", err);
      setError(err?.message ?? String(err));
    } finally {
      setIsResolvingENS(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || (!messageText.trim() && !attachedFile)) {
      return;
    }

    setError(null);

    try {
      const swapParams = parseSwapCommand(messageText);

      if (swapParams) {
        const quote = await getSwapQuote(
          swapParams.amount,
          swapParams.fromToken,
          swapParams.toToken
        );
        setSwapQuote({ ...swapParams, quote });
        return;
      }

      if (attachedFile) {
        const ipfsHash = await uploadToIPFS(attachedFile, client);
        await selectedConversation.send(`File: ${ipfsHash}`);
        setAttachedFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        await selectedConversation.send(messageText);
      }

      setMessageText("");
      const nextMessages = await selectedConversation.messages();
      setMessages(nextMessages || []);
    } catch (err) {
      console.error("sendMessage error:", err);
      setError(err?.message ?? String(err));
    }
  };

  const confirmSwap = async () => {
    if (!swapQuote || !selectedConversation) {
      return;
    }

    try {
      await selectedConversation.send(
        `Swap confirmed: ${swapQuote.amount} ${swapQuote.fromToken} -> ${swapQuote.quote.amountOut} ${swapQuote.toToken}`
      );
      setSwapQuote(null);
      setMessageText("");
    } catch (err) {
      console.error("Swap confirmation error:", err);
      setError(err?.message ?? String(err));
    }
  };

  const sendPayment = async () => {
    if (!paymentAmount || !paymentRecipient) {
      return;
    }

    try {
      const amount = parseEther(paymentAmount);
      const recipient = getAddress(paymentRecipient);

      await sendTransaction({
        to: recipient,
        value: amount,
      });

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentRecipient("");
    } catch (err) {
      console.error("Payment error:", err);
      setError(err?.message ?? String(err));
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      setAttachedFile(file);
    }
  };

  const formatAddress = (value) => {
    if (!value) {
      return "";
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const formatConversationLabel = (conversation) => {
    const peerAddress = conversationAddresses[conversation.id];

    if (peerAddress) {
      return formatAddress(peerAddress);
    }

    if (conversation.name) {
      return conversation.name;
    }

    return `Conversation ${conversation.id.slice(0, 8)}`;
  };

  const selectedPeerAddress = selectedConversation
    ? conversationAddresses[selectedConversation.id]
    : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
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
                disabled={isConnectingWallet}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded"
              >
                {isConnectingWallet ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow flex overflow-hidden">
        {!isConnected ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl text-gray-400 mb-4">Please connect your wallet to begin</p>
              <button
                onClick={handleConnect}
                disabled={isConnectingWallet}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                {isConnectingWallet ? "Connecting..." : "Connect Wallet"}
              </button>
              {error && <p className="text-red-400 mt-4 max-w-md">{error}</p>}
            </div>
          </div>
        ) : status === "initializing" ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-lg">Initializing XMTP (approve the signature request)...</p>
          </div>
        ) : status === "error" ? (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-red-400">Error: {error}</p>
              <button
                onClick={() => disconnect()}
                className="mt-4 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : status === "ready" ? (
          <>
            <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold mb-3">Conversations</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChatAddress}
                    onChange={(event) => setNewChatAddress(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void startConversation();
                      }
                    }}
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
                    No conversations yet. Start a new chat.
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-700 ${
                        selectedConversation?.id === conversation.id ? "bg-gray-700" : ""
                      }`}
                    >
                      <div className="font-medium">
                        {formatConversationLabel(conversation)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-gray-900">
              {error && (
                <div className="px-4 py-3 bg-red-950 text-red-200 border-b border-red-800">
                  {error}
                </div>
              )}

              {!selectedConversation ? (
                <div className="flex-grow flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <p className="text-lg">Select or create a conversation to start chatting</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">
                        {selectedPeerAddress
                          ? formatAddress(selectedPeerAddress)
                          : formatConversationLabel(selectedConversation)}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!selectedPeerAddress) {
                            setError("Unable to resolve the wallet address for this conversation.");
                            return;
                          }

                          setShowPaymentModal(true);
                          setPaymentRecipient(selectedPeerAddress);
                        }}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm"
                      >
                        Pay
                      </button>
                      <button
                        onClick={() => setShowVideoCall(true)}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                      >
                        Video Call
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500">No messages yet.</div>
                    ) : (
                      messages.map((message) => {
                        const isMe = message.senderInboxId === client?.inboxId;
                        const content =
                          typeof message.content === "string"
                            ? message.content
                            : String(message.content ?? "");
                        const ipfsHash = extractIPFSHash(content);
                        const isFile = content.startsWith("File: ipfs://");
                        const sentAt = messageToDate(message);

                        return (
                          <div
                            key={message.id}
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
                                  <p className="text-sm mb-2">File attachment</p>
                                  <a
                                    href={`${
                                      process.env.NEXT_PUBLIC_PINATA_GATEWAY ||
                                      "https://gateway.pinata.cloud/ipfs/"
                                    }${ipfsHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs underline"
                                  >
                                    View on IPFS
                                  </a>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap">{content}</p>
                              )}
                              {sentAt && (
                                <p className="text-xs opacity-70 mt-1">
                                  {sentAt.toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

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

                  {showVideoCall && (
                    <VideoCall
                      conversation={selectedConversation}
                      xmtpClient={client}
                      onClose={() => setShowVideoCall(false)}
                    />
                  )}

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
                              onChange={(event) => setPaymentRecipient(event.target.value)}
                              className="w-full p-2 rounded bg-gray-700"
                              placeholder="0x..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Amount (MATIC)</label>
                            <input
                              type="number"
                              value={paymentAmount}
                              onChange={(event) => setPaymentAmount(event.target.value)}
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
                            disabled={
                              isSendingTx ||
                              isConfirmingTx ||
                              !paymentAmount ||
                              !paymentRecipient
                            }
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
                          >
                            {isSendingTx || isConfirmingTx ? "Processing..." : "Send"}
                          </button>
                        </div>
                        {isTxSuccess && (
                          <p className="text-green-400 text-sm mt-2">
                            Payment sent successfully.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

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
                        Attach
                      </label>
                      {attachedFile && (
                        <span className="text-sm text-gray-400 self-center">
                          {attachedFile.name}
                        </span>
                      )}
                      <input
                        type="text"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
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
