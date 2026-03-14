import { getAddress, hexToBytes } from "viem";

export function buildEthereumIdentifier(address) {
  return {
    identifier: getAddress(address),
    identifierKind: "Ethereum",
  };
}

export function identifierToAddress(identifier) {
  if (!identifier || identifier.identifierKind !== "Ethereum") {
    return null;
  }

  try {
    return getAddress(identifier.identifier);
  } catch {
    return null;
  }
}

export function signatureHexToBytes(signature) {
  return hexToBytes(signature);
}

export function messageToDate(message) {
  if (typeof message?.sentAtNs !== "bigint") {
    return null;
  }

  return new Date(Number(message.sentAtNs / 1000000n));
}

export async function resolveDmPeerAddress(client, conversation) {
  if (!client || !conversation?.peerInboxId) {
    return null;
  }

  const peerInboxId = await conversation.peerInboxId();
  const inboxStates = await client.preferences.inboxStateFromInboxIds([peerInboxId]);
  const identifiers = inboxStates?.[0]?.identifiers ?? [];

  for (const identifier of identifiers) {
    const address = identifierToAddress(identifier);

    if (address) {
      return address;
    }
  }

  return null;
}
