"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { checkNFTBalance, checkTokenBalance } from "../utils/token-gating";

export default function TokenGatedGroup({ onJoin, groupRules }) {
  const { address } = useAccount();
  const [checking, setChecking] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [error, setError] = useState(null);

  const checkAccess = async () => {
    if (!address || !groupRules) return;

    setChecking(true);
    setError(null);

    try {
      let access = false;

      if (groupRules.type === "nft") {
        access = await checkNFTBalance(address, groupRules.contractAddress);
      } else if (groupRules.type === "token") {
        access = await checkTokenBalance(
          address,
          groupRules.contractAddress,
          groupRules.minBalance || "0"
        );
      }

      setHasAccess(access);
      if (access && onJoin) {
        onJoin();
      } else if (!access) {
        setError("You don't have access to this group. Required: " + JSON.stringify(groupRules));
      }
    } catch (err) {
      console.error("Access check error:", err);
      setError("Failed to check access");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded border border-gray-700">
      <h3 className="font-semibold mb-2">Token-Gated Group</h3>
      {groupRules && (
        <div className="mb-3 text-sm text-gray-400">
          <p>Type: {groupRules.type}</p>
          <p>Contract: {groupRules.contractAddress}</p>
          {groupRules.minBalance && <p>Min Balance: {groupRules.minBalance}</p>}
        </div>
      )}
      {hasAccess === null && (
        <button
          onClick={checkAccess}
          disabled={checking || !address}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded"
        >
          {checking ? "Checking..." : "Check Access & Join"}
        </button>
      )}
      {hasAccess === true && (
        <p className="text-green-400 text-sm">✓ You have access!</p>
      )}
      {hasAccess === false && (
        <p className="text-red-400 text-sm">✗ Access denied</p>
      )}
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}

