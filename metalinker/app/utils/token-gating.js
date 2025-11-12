// Token-gated group chat functionality
import { createPublicClient, http, formatUnits } from 'viem';
import { polygon } from 'viem/chains';

// Helper function to get Polygon RPC URL
const getPolygonRpcUrl = () => {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  
  // If it's already a full URL, use it
  if (apiKey && (apiKey.startsWith('http://') || apiKey.startsWith('https://'))) {
    return apiKey;
  }
  
  // If it's just an API key, construct the URL
  if (apiKey && !apiKey.includes('://')) {
    return `https://polygon-mainnet.g.alchemy.com/v2/${apiKey}`;
  }
  
  // Fallback to public RPC
  return 'https://polygon-rpc.com';
};

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(getPolygonRpcUrl()),
});

// ERC721 (NFT) balance check
export async function checkNFTBalance(userAddress, nftContractAddress) {
  try {
    // ERC721 balanceOf(address) -> uint256
    const balance = await publicClient.readContract({
      address: nftContractAddress,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [userAddress],
    });

    return Number(balance) > 0;
  } catch (error) {
    console.error('NFT balance check error:', error);
    return false;
  }
}

// ERC20 token balance check
export async function checkTokenBalance(userAddress, tokenContractAddress, minBalance = '0') {
  try {
    const balance = await publicClient.readContract({
      address: tokenContractAddress,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ],
      functionName: 'balanceOf',
      args: [userAddress],
    });

    const decimals = await publicClient.readContract({
      address: tokenContractAddress,
      abi: [
        {
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
      ],
      functionName: 'decimals',
    });

    const balanceFormatted = formatUnits(balance, decimals);
    return parseFloat(balanceFormatted) >= parseFloat(minBalance);
  } catch (error) {
    console.error('Token balance check error:', error);
    return false;
  }
}

// Group chat rules structure
export function createGroupRules(type, contractAddress, minBalance = '0') {
  return {
    type, // 'nft' or 'token'
    contractAddress,
    minBalance,
  };
}

