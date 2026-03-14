import { buildEthereumIdentifier, signatureHexToBytes } from "./xmtp";

export function createXmtpSignerFromWalletClient(walletClient) {
  return {
    type: "EOA",
    getIdentifier: async () => {
      let address;

      if (walletClient?.getAddresses) {
        const addrs = await walletClient.getAddresses();
        address = Array.isArray(addrs) ? addrs[0] : addrs;
      } else if (walletClient?.account?.address) {
        address = walletClient.account.address;
      } else if (window?.ethereum?.selectedAddress) {
        address = window.ethereum.selectedAddress;
      } else {
        throw new Error("Unable to determine wallet address");
      }

      return buildEthereumIdentifier(address);
    },
    signMessage: async (message) => {
      if (!walletClient || typeof walletClient.signMessage !== "function") {
        throw new Error("Wallet client does not support signMessage");
      }

      try {
        if (typeof message !== "string") {
          throw new Error("XMTP signer expected a string message");
        }

        const sig = await walletClient.signMessage(
          walletClient.account
            ? { account: walletClient.account, message }
            : { message }
        );

        if (typeof sig !== "string" || !sig.startsWith("0x")) {
          throw new Error("Invalid signature generated");
        }

        return signatureHexToBytes(sig);
      } catch (err) {
        console.error("Failed to sign XMTP message:", err);
        throw err;
      }
    },
  };
}
