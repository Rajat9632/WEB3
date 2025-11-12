/**
 * Create a signer adapter for XMTP that:
 *  - provides getIdentifier() -> { identifier, identifierKind }
 *  - provides signMessage(message) -> hex string signature
 *
 * This tries a few walletClient shapes (viem/wagmi) and falls back to window.ethereum (MetaMask).
 */

function toHexUtf8(message) {
  if (typeof message === "string") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(message);
    return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  if (message instanceof Uint8Array) {
    return "0x" + Array.from(message).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // fallback stringify
  return "0x" + Array.from(new TextEncoder().encode(String(message))).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createXmtpSignerFromWalletClient(walletClient) {
  // helper to read address from many shapes
  async function readAddress() {
    try {
      // viem: getAddresses()
      if (walletClient?.getAddresses && typeof walletClient.getAddresses === "function") {
        const addrs = await walletClient.getAddresses();
        return Array.isArray(addrs) ? addrs[0] : addrs;
      }
      // wagmi's walletClient: getAccount()
      if (walletClient?.getAccount && typeof walletClient.getAccount === "function") {
        const a = await walletClient.getAccount();
        if (a?.address) return a.address;
        if (typeof a === "string") return a;
      }
      // some shapes expose .account
      if (walletClient?.account) return walletClient.account;
      // fallback to window.ethereum
      if (window?.ethereum?.selectedAddress) return window.ethereum.selectedAddress;
      if (window?.ethereum && window.ethereum.request) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (Array.isArray(accounts) && accounts.length > 0) return accounts[0];
      }
    } catch (e) {
      console.warn("readAddress error:", e);
    }
    throw new Error("Unable to determine wallet address for XMTP signer.");
  }

  // signMessage must return a hex string signature ("0x...")
  async function signMessage(message) {
    // normalize to hex for personal_sign usage
    const hexMsg = toHexUtf8(message);
    // Try several common call shapes

    // 1) walletClient.signMessage({ message }) or walletClient.signMessage(message)
    try {
      if (walletClient?.signMessage && typeof walletClient.signMessage === "function") {
        // some viem versions need an object: { message }
        try {
          const maybe = await walletClient.signMessage({ message });
          if (typeof maybe === "string") return maybe;
        } catch (_) {
          const maybe2 = await walletClient.signMessage(message);
          if (typeof maybe2 === "string") return maybe2;
        }
      }
    } catch (e) {
      console.warn("walletClient.signMessage attempt failed:", e);
    }

    // 2) walletClient.request({ method: 'personal_sign', params: [hex, address] })
    try {
      if (walletClient?.request && typeof walletClient.request === "function") {
        const address = (await readAddress());
        const sig = await walletClient.request({
          method: "personal_sign",
          params: [hexMsg, address],
        });
        if (typeof sig === "string") return sig;
      }
    } catch (e) {
      console.warn("walletClient.request personal_sign attempt failed:", e);
    }

    // 3) window.ethereum.request personal_sign (MetaMask)
    try {
      if (window?.ethereum && typeof window.ethereum.request === "function") {
        const addr = (await readAddress());
        const sig = await window.ethereum.request({
          method: "personal_sign",
          params: [hexMsg, addr],
        });
        if (typeof sig === "string") return sig;
      }
    } catch (e) {
      console.warn("window.ethereum.personal_sign attempt failed:", e);
    }

    // 4) eth_sign fallback (less recommended)
    try {
      if (window?.ethereum && typeof window.ethereum.request === "function") {
        const addr = (await readAddress());
        const sig = await window.ethereum.request({
          method: "eth_sign",
          params: [addr, hexMsg],
        });
        if (typeof sig === "string") return sig;
      }
    } catch (e) {
      console.warn("window.ethereum.eth_sign attempt failed:", e);
    }

    throw new Error("No supported signing method found on walletClient/provider.");
  }

  return {
    type: "EOA",
    // XMTP (WASM) expects an object with identifier + identifierKind
    getIdentifier: async () => {
      const address = await readAddress();
      // identifierKind "Ethereum" is what XMTP wasm expects
      return { identifier: address, identifierKind: "Ethereum" };
    },
    signMessage,
  };
}

