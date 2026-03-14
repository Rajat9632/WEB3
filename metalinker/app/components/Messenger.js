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
import { resolveENS, reverseResolveENS } from "../utils/ens";
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

function getCurrentBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function getIncomingChatTarget() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URL(window.location.href).searchParams.get("chat")?.trim() || "";
}

export default function Messenger() {
  const xmtpEnv = process.env.NEXT_PUBLIC_XMTP_ENV || "dev";
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
  const [conversationNames, setConversationNames] = useState({});
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
  const [myEnsName, setMyEnsName] = useState("");
  const [shareBaseUrl, setShareBaseUrl] = useState("");
  const [incomingChatTarget, setIncomingChatTarget] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const shareFeedbackTimeoutRef = useRef(null);
  const autoStartedRecipientRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const syncUrlState = () => {
      setShareBaseUrl(getCurrentBaseUrl());
      setIncomingChatTarget(getIncomingChatTarget());
    };

    syncUrlState();
    window.addEventListener("popstate", syncUrlState);

    return () => {
      window.removeEventListener("popstate", syncUrlState);
    };
  }, []);

  useEffect(() => {
    if (!incomingChatTarget) {
      return;
    }

    setNewChatAddress((currentValue) => currentValue || incomingChatTarget);
  }, [incomingChatTarget]);

  useEffect(() => {
    autoStartedRecipientRef.current = null;
  }, [incomingChatTarget]);

  useEffect(() => {
    if (!address) {
      setMyEnsName("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const resolvedName = await reverseResolveENS(getAddress(address));

        if (!cancelled) {
          setMyEnsName(resolvedName !== getAddress(address) ? resolvedName : "");
        }
      } catch (err) {
        console.error("Failed to reverse resolve connected wallet ENS:", err);

        if (!cancelled) {
          setMyEnsName("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    return () => {
      if (shareFeedbackTimeoutRef.current) {
        clearTimeout(shareFeedbackTimeoutRef.current);
      }
    };
  }, []);

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
    setConversationNames({});
    setSelectedConversation(null);
    setMessages([]);
    setSwapQuote(null);
    setAttachedFile(null);
    setShowPaymentModal(false);
    setShowVideoCall(false);
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
  }, [walletClient, isConnected, xmtpEnv]);

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
    const unresolvedConversationIds = Object.entries(conversationAddresses)
      .filter(([conversationId, peerAddress]) => peerAddress && !conversationNames[conversationId])
      .map(([conversationId]) => conversationId);

    if (unresolvedConversationIds.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      for (const conversationId of unresolvedConversationIds) {
        const peerAddress = conversationAddresses[conversationId];

        if (!peerAddress) {
          continue;
        }

        try {
          const resolvedName = await reverseResolveENS(peerAddress);

          if (!cancelled && resolvedName && resolvedName !== peerAddress) {
            setConversationNames((prev) => {
              if (prev[conversationId] === resolvedName) {
                return prev;
              }

              return {
                ...prev,
                [conversationId]: resolvedName,
              };
            });
          }
        } catch (err) {
          console.error("Failed to reverse resolve conversation ENS:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationAddresses, conversationNames]);

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

  const setTemporaryShareFeedback = (message) => {
    setShareFeedback(message);

    if (shareFeedbackTimeoutRef.current) {
      clearTimeout(shareFeedbackTimeoutRef.current);
    }

    shareFeedbackTimeoutRef.current = setTimeout(() => {
      setShareFeedback("");
    }, 2500);
  };

  const formatAddress = (value) => {
    if (!value) {
      return "";
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  const formatRecipient = (value) => {
    if (!value) {
      return "";
    }

    return isAddress(value) ? formatAddress(getAddress(value)) : value;
  };

  const getShareLink = () => {
    if (!address || !shareBaseUrl) {
      return "";
    }

    const url = new URL(shareBaseUrl);
    url.searchParams.set("chat", getAddress(address));
    return url.toString();
  };

  const copyText = async (value, successMessage) => {
    if (!value) {
      setError("Nothing to copy yet.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setTemporaryShareFeedback(successMessage);
    } catch (err) {
      console.error("Copy failed:", err);
      setError("Failed to copy. Your browser may be blocking clipboard access.");
    }
  };

  const handleShareProfile = async () => {
    const shareLink = getShareLink();

    if (!shareLink || !address) {
      setError("Your share link is not ready yet.");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Web3 Messenger chat invite",
          text: myEnsName
            ? `Start a chat with ${myEnsName} (${getAddress(address)})`
            : `Start a chat with ${getAddress(address)}`,
          url: shareLink,
        });
        setTemporaryShareFeedback("Share sheet opened.");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }

      console.error("Native share failed:", err);
    }

    await copyText(shareLink, "Share link copied.");
  };

  const startConversation = async (targetValue = newChatAddress, options = {}) => {
    if (!client || !targetValue.trim()) {
      return false;
    }

    setIsResolvingENS(true);
    setError(null);

    try {
      let resolvedAddress = targetValue.trim();

      if (resolvedAddress.endsWith(".eth")) {
        resolvedAddress = await resolveENS(resolvedAddress);
      }

      if (!isAddress(resolvedAddress)) {
        throw new Error("Invalid address or ENS name");
      }

      const checksumAddress = getAddress(resolvedAddress);

      if (address && checksumAddress === getAddress(address)) {
        throw new Error("You cannot start a conversation with your own wallet.");
      }

      const existingConversation = conversations.find(
        (conversation) => conversationAddresses[conversation.id] === checksumAddress
      );

      if (existingConversation) {
        setSelectedConversation(existingConversation);

        if (!options.keepInput) {
          setNewChatAddress("");
        }

        return true;
      }

      const identifier = buildEthereumIdentifier(checksumAddress);
      const canMessage = await client.canMessage([identifier]);
      const isReachable =
        canMessage.get(checksumAddress) ??
        canMessage.get(checksumAddress.toLowerCase()) ??
        canMessage.get(identifier.identifier) ??
        canMessage.get(identifier.identifier.toLowerCase());

      if (!isReachable) {
        throw new Error(
          `This wallet is not available on XMTP ${xmtpEnv}. Ask them to connect once and approve XMTP first.`
        );
      }

      const conversation = await client.conversations.newDmWithIdentifier(identifier);

      setSelectedConversation(conversation);

      if (!options.keepInput) {
        setNewChatAddress("");
      }

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

      return true;
    } catch (err) {
      console.error("startConversation error:", err);
      setError(err?.message ?? String(err));
      return false;
    } finally {
      setIsResolvingENS(false);
    }
  };

  useEffect(() => {
    if (status !== "ready" || !incomingChatTarget) {
      return;
    }

    if (autoStartedRecipientRef.current === incomingChatTarget) {
      return;
    }

    autoStartedRecipientRef.current = incomingChatTarget;
    void startConversation(incomingChatTarget, { keepInput: true });
  }, [incomingChatTarget, status]);

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

  const formatConversationLabel = (conversation) => {
    const peerName = conversationNames[conversation.id];

    if (peerName) {
      return peerName;
    }

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
  const selectedPeerName = selectedConversation
    ? conversationNames[selectedConversation.id]
    : "";
  const shareLink = getShareLink();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 p-4 shadow-md border-b border-gray-700">
        <div className="container mx-auto flex justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-indigo-400">Web3 Messenger</h1>
            <p className="text-xs text-gray-400 mt-1">
              Direct wallet-to-wallet chat on XMTP {xmtpEnv}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isConnected && address && (
              <span className="text-sm text-gray-400">
                {myEnsName ? `${myEnsName} - ${formatAddress(address)}` : formatAddress(address)}
              </span>
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
          <div className="flex-grow flex items-center justify-center p-6">
            <div className="text-center max-w-xl">
              <p className="text-xl text-gray-300 mb-3">Connect your wallet to begin messaging.</p>
              <p className="text-sm text-gray-500 mb-6">
                After you connect once, the app creates your XMTP inbox and gives you a shareable
                chat link.
              </p>
              {incomingChatTarget && (
                <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-left">
                  <p className="text-sm font-medium text-indigo-200">Invite link detected</p>
                  <p className="mt-1 text-sm text-indigo-100">
                    Connect this wallet to start chatting with {formatRecipient(incomingChatTarget)}.
                  </p>
                </div>
              )}
              <button
                onClick={handleConnect}
                disabled={isConnectingWallet}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-lg text-lg font-semibold"
              >
                {isConnectingWallet ? "Connecting..." : "Connect Wallet"}
              </button>
              {error && <p className="text-red-400 mt-4 max-w-md mx-auto">{error}</p>}
            </div>
          </div>
        ) : status === "initializing" ? (
          <div className="flex-grow flex items-center justify-center p-6">
            <div className="text-center max-w-lg">
              <p className="text-lg">
                Initializing XMTP. Approve the signature request in MetaMask.
              </p>
              {incomingChatTarget && (
                <p className="text-sm text-gray-400 mt-3">
                  Your invite link is ready and will open chat with{" "}
                  {formatRecipient(incomingChatTarget)} once setup completes.
                </p>
              )}
            </div>
          </div>
        ) : status === "error" ? (
          <div className="flex-grow flex items-center justify-center p-6">
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
              <div className="p-4 border-b border-gray-700 space-y-4">
                <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-slate-800 to-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
                    Your Chat ID
                  </p>
                  <p className="mt-3 text-sm font-semibold text-white break-all">
                    {myEnsName || "Wallet Address"}
                  </p>
                  <p className="mt-1 text-xs text-indigo-100/80 break-all">
                    {address ? getAddress(address) : ""}
                  </p>
                  <p className="mt-3 text-xs text-gray-300">
                    Share your wallet or link. Anyone on XMTP {xmtpEnv} can start a DM from it.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        copyText(
                          address ? getAddress(address) : "",
                          "Wallet address copied."
                        )
                      }
                      className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded text-xs"
                    >
                      Copy Address
                    </button>
                    <button
                      onClick={() => copyText(shareLink, "Share link copied.")}
                      className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded text-xs"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={handleShareProfile}
                      className="bg-indigo-500 hover:bg-indigo-400 px-3 py-2 rounded text-xs font-medium"
                    >
                      Share
                    </button>
                  </div>
                  {shareFeedback && (
                    <p className="mt-3 text-xs text-emerald-300">{shareFeedback}</p>
                  )}
                </div>

                <div>
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
                      onClick={() => void startConversation()}
                      disabled={isResolvingENS || !newChatAddress.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded text-sm"
                    >
                      {isResolvingENS ? "..." : "+"}
                    </button>
                  </div>
                  {incomingChatTarget && !selectedConversation && (
                    <p className="mt-2 text-xs text-indigo-300">
                      Invite ready for {formatRecipient(incomingChatTarget)}.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No conversations yet. Share your chat link to invite someone in.
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const peerAddress = conversationAddresses[conversation.id];
                    const peerName = conversationNames[conversation.id];

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation)}
                        className={`w-full p-3 text-left border-b border-gray-700 hover:bg-gray-700 ${
                          selectedConversation?.id === conversation.id ? "bg-gray-700" : ""
                        }`}
                      >
                        <div className="font-medium">{formatConversationLabel(conversation)}</div>
                        {peerName && peerAddress && (
                          <div className="text-xs text-gray-400 mt-1">
                            {formatAddress(peerAddress)}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-gray-900 relative">
              {error && (
                <div className="px-4 py-3 bg-red-950 text-red-200 border-b border-red-800">
                  {error}
                </div>
              )}

              {!selectedConversation ? (
                <div className="flex-grow flex items-center justify-center p-6">
                  <div className="text-center text-gray-400 max-w-xl">
                    <p className="text-lg">
                      Select or create a conversation to start chatting.
                    </p>
                    <p className="text-sm text-gray-500 mt-3">
                      The easiest flow is to send someone your chat link, let them connect once,
                      and the DM opens automatically.
                    </p>
                    {shareLink && (
                      <button
                        onClick={() => copyText(shareLink, "Share link copied.")}
                        className="mt-5 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded"
                      >
                        Copy My Chat Link
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center gap-4">
                    <div>
                      <h3 className="font-semibold">
                        {selectedPeerName ||
                          (selectedPeerAddress
                            ? formatAddress(selectedPeerAddress)
                            : formatConversationLabel(selectedConversation))}
                      </h3>
                      {selectedPeerName && selectedPeerAddress && (
                        <p className="text-xs text-gray-400 mt-1">{selectedPeerAddress}</p>
                      )}
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
                        onClick={() => void sendMessage()}
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
