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
  // XMTP passes messages as Uint8Array - we need to handle this correctly
  async function signMessage(message) {
    console.log("🔐 XMTP signMessage called with:", {
      type: typeof message,
      isUint8Array: message instanceof Uint8Array,
      length: message instanceof Uint8Array ? message.length : message?.length,
      firstBytes: message instanceof Uint8Array ? Array.from(message.slice(0, 10)) : null,
    });

    const address = await readAddress();
    console.log("📍 Signing with address:", address);

    // PRIMARY METHOD: Use viem's signMessage with Uint8Array directly
    // XMTP expects Uint8Array to be signed as-is, without conversion
    // CRITICAL: We must use viem's signMessage, NOT personal_sign, to preserve message format
    try {
      if (walletClient?.signMessage && typeof walletClient.signMessage === "function") {
        console.log("🔄 PRIMARY: Attempting viem signMessage (preserves Uint8Array format)...");
        
        // For Uint8Array, pass directly to viem - DO NOT convert
        // viem's signMessage handles Uint8Array correctly and preserves format
        if (message instanceof Uint8Array) {
          try {
            console.log("📦 Message is Uint8Array, passing directly to viem (no conversion)");
            
            // Pass Uint8Array directly to viem - it handles the format correctly
            // viem will use the walletClient's account automatically
            const sig = await walletClient.signMessage({ 
              message: message
            });
            
            // Validate signature format
            if (typeof sig === "string" && sig.startsWith("0x")) {
              // Signature should be 132 chars (0x + 130 hex chars)
              const sigLength = sig.length;
              console.log("✅ Got signature from viem, length:", sigLength);
              console.log("✅ Signature preview:", sig.substring(0, 20) + "...");
              
              if (sigLength === 132) {
                console.log("✅ Signature format valid (132 chars) - returning to XMTP");
                return sig;
              } else {
                console.warn("⚠️ Signature length unexpected:", sigLength, "expected 132");
                console.warn("⚠️ Returning anyway - XMTP might accept it");
                return sig;
              }
            } else {
              console.warn("⚠️ Invalid signature format from viem:", typeof sig, sig);
            }
          } catch (viemError) {
            console.error("❌ viem signMessage (Uint8Array) failed:", viemError);
            console.error("❌ Error details:", {
              message: viemError.message,
              code: viemError.code,
              name: viemError.name
            });
            // Don't throw - try fallback methods, but warn that it might not work
            console.warn("⚠️ Falling back to personal_sign - this may cause XMTP validation to fail!");
          }
        }
        // For string messages
        else if (typeof message === "string") {
          try {
            const sig = await walletClient.signMessage({ message });
            if (typeof sig === "string" && sig.startsWith("0x")) {
              console.log("✅ Successfully signed with viem (string)");
              return sig;
            }
          } catch (viemError) {
            console.warn("❌ viem signMessage (string) failed:", viemError);
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ walletClient.signMessage attempt failed:", e);
    }

    // FALLBACK: Use personal_sign with hex conversion
    // NOTE: This might not work correctly for XMTP as it changes message format
    // But we'll try it as a fallback
    let messageHex;
    if (message instanceof Uint8Array) {
      // Convert Uint8Array to hex string for personal_sign
      // WARNING: This conversion might cause validation issues with XMTP
      messageHex = "0x" + Array.from(message).map(b => b.toString(16).padStart(2, "0")).join("");
      console.log("⚠️ FALLBACK: Converted Uint8Array to hex for personal_sign, length:", messageHex.length);
      console.log("⚠️ WARNING: This conversion might cause XMTP validation to fail!");
    } else if (typeof message === "string") {
      // Convert string to hex if not already
      messageHex = message.startsWith("0x") ? message : toHexUtf8(message);
    } else {
      messageHex = toHexUtf8(String(message));
    }

    // Try window.ethereum personal_sign (MetaMask) - fallback only
    // NOTE: This is less reliable for XMTP as it converts the message format
    try {
      if (window?.ethereum && typeof window.ethereum.request === "function") {
        console.log("🔄 FALLBACK: Attempting window.ethereum personal_sign...");
        console.log("⚠️ This may not work correctly with XMTP due to message format conversion");
        
        const sig = await window.ethereum.request({
          method: "personal_sign",
          params: [messageHex, address],
        });
        
        if (typeof sig === "string" && sig.startsWith("0x")) {
          const sigLength = sig.length;
          console.log("✅ Got signature from window.ethereum, length:", sigLength);
          
          if (sigLength === 132) {
            console.log("✅ Signature format valid (132 chars)");
            return sig;
          } else {
            console.warn("⚠️ Signature length unexpected:", sigLength, "expected 132");
            return sig; // Return anyway
          }
        } else {
          console.warn("⚠️ Invalid signature format from window.ethereum");
        }
      }
    } catch (e) {
      console.warn("❌ window.ethereum.personal_sign attempt failed:", e);
      // If user rejected, provide helpful error
      if (e.code === 4001 || e.message?.includes("rejected") || e.message?.includes("denied")) {
        throw new Error("Signature request was rejected. Please approve the signature in MetaMask to initialize XMTP.");
      }
      // Re-throw other errors so we can try next method
      throw e;
    }

    // Last resort: try walletClient.request
    try {
      if (walletClient?.request && typeof walletClient.request === "function") {
        console.log("🔄 Attempting walletClient.request personal_sign...");
        const sig = await walletClient.request({
          method: "personal_sign",
          params: [messageHex, address],
        });
        if (typeof sig === "string" && sig.startsWith("0x")) {
          console.log("✅ Successfully signed with walletClient.request");
          return sig;
        }
      }
    } catch (e) {
      console.warn("❌ walletClient.request personal_sign attempt failed:", e);
    }

    throw new Error("No supported signing method found. Please ensure your wallet is connected and supports message signing. Make sure you approve the signature request in MetaMask.");
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

