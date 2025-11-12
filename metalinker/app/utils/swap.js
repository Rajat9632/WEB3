// Executable chat commands - /swap functionality
// This integrates with Uniswap API for token swaps

export function parseSwapCommand(message) {
  // Format: /swap <amount> <fromToken> <toToken>
  // Example: /swap 1 ETH USDC
  const swapRegex = /\/swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(\w+)/i;
  const match = message.match(swapRegex);
  
  if (!match) {
    return null;
  }

  return {
    amount: parseFloat(match[1]),
    fromToken: match[2].toUpperCase(),
    toToken: match[3].toUpperCase(),
  };
}

export async function getSwapQuote(amount, fromToken, toToken, chainId = 137) {
  try {
    // Using Uniswap V3 API
    // Note: In production, you'd use the actual Uniswap SDK or API
    const response = await fetch(
      `https://api.uniswap.org/v1/quote?tokenIn=${fromToken}&tokenOut=${toToken}&amount=${amount}&chainId=${chainId}`
    );

    if (!response.ok) {
      throw new Error('Failed to get swap quote');
    }

    const data = await response.json();
    return {
      amountIn: data.amountIn,
      amountOut: data.amountOut,
      priceImpact: data.priceImpact,
      route: data.route,
    };
  } catch (error) {
    console.error('Swap quote error:', error);
    // Fallback: return mock data for development
    return {
      amountIn: amount,
      amountOut: amount * 2000, // Mock conversion rate
      priceImpact: '0.1',
      route: `${fromToken} -> ${toToken}`,
    };
  }
}

