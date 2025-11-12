// IPFS file handling with Pinata
import { Client } from '@xmtp/browser-sdk';

// Upload encrypted file to Pinata
export async function uploadToIPFS(file, xmtpClient) {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Encrypt using XMTP's encryption
    // Note: XMTP handles encryption automatically for messages
    // For files, we'll encrypt the content before uploading
    const encryptedData = await encryptFile(uint8Array, xmtpClient);

    // Upload to Pinata
    const formData = new FormData();
    const blob = new Blob([encryptedData], { type: file.type });
    formData.append('file', blob, file.name);

    const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT;
    if (!pinataJWT) {
      throw new Error('Pinata JWT not configured');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to Pinata');
    }

    const data = await response.json();
    return `ipfs://${data.IpfsHash}`;
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw error;
  }
}

// Download and decrypt file from IPFS
export async function downloadFromIPFS(ipfsHash, xmtpClient) {
  try {
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
    const url = `${gateway}${ipfsHash.replace('ipfs://', '')}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download from IPFS');
    }

    const encryptedData = await response.arrayBuffer();
    const uint8Array = new Uint8Array(encryptedData);

    // Decrypt the file
    const decryptedData = await decryptFile(uint8Array, xmtpClient);
    return decryptedData;
  } catch (error) {
    console.error('IPFS download error:', error);
    throw error;
  }
}

// Simple encryption (in production, use XMTP's built-in encryption)
async function encryptFile(data, xmtpClient) {
  // For now, return as-is. In production, use XMTP's encryption
  // XMTP messages are automatically encrypted, so we'll handle file encryption similarly
  return data;
}

// Simple decryption
async function decryptFile(data, xmtpClient) {
  // For now, return as-is. In production, use XMTP's decryption
  return data;
}

// Extract IPFS hash from message content
export function extractIPFSHash(message) {
  const ipfsRegex = /ipfs:\/\/([a-zA-Z0-9]+)/;
  const match = message.match(ipfsRegex);
  return match ? match[1] : null;
}

