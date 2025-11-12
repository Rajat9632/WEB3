// ENS Resolution using viem
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Create public client for ENS resolution (Ethereum mainnet)
// Note: ENS names resolve on Ethereum mainnet, not Polygon
const getPublicClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  // If API key is for Polygon, try to extract and use for Ethereum
  let ethRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/demo';
  
  if (apiKey && apiKey.includes('alchemy.com')) {
    // Extract API key from Polygon URL and use for Ethereum
    const match = apiKey.match(/v2\/([^/]+)/);
    if (match) {
      ethRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${match[1]}`;
    }
  }
  
  return createPublicClient({
    chain: mainnet,
    transport: http(ethRpcUrl),
  });
};

export async function resolveENS(name) {
  try {
    if (!name.endsWith('.eth')) {
      return name; // Return as-is if not .eth
    }
    const publicClient = getPublicClient();
    const address = await publicClient.getEnsAddress({ name });
    return address || name;
  } catch (error) {
    console.error('ENS resolution error:', error);
    return name; // Return original if resolution fails
  }
}

export async function reverseResolveENS(address) {
  try {
    const publicClient = getPublicClient();
    const name = await publicClient.getEnsName({ address });
    return name || address;
  } catch (error) {
    console.error('Reverse ENS resolution error:', error);
    return address;
  }
}

