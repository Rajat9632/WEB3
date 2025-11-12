// In-chat payment functionality
import { parseEther } from 'viem';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';

export function useSendPayment() {
  const { sendTransaction, data: hash, isPending, error } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const sendPayment = async (toAddress, amountInMATIC) => {
    try {
      const amount = parseEther(amountInMATIC.toString());
      await sendTransaction({
        to: toAddress,
        value: amount,
      });
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  };

  return {
    sendPayment,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

