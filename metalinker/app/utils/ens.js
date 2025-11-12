// ENS Resolution using viem
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Create public client for ENS resolution (Ethereum mainnet)
// Note: ENS names resolve on Ethereum mainnet, not Polygon
const getPublicClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  let ethRpcUrl = 'https://eth-mainnet.g.alchemy.com/v2/demo';
  
  if (apiKey) {
    // If it's a full URL, extract the key
    if (apiKey.includes('alchemy.com')) {
      const match = apiKey.match(/v2\/([^/]+)/);
      if (match) {
        ethRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${match[1]}`;
      }
    } 
    // If it's just an API key (no http:// or https://), use it directly
    else if (!apiKey.includes('://')) {
      ethRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
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

