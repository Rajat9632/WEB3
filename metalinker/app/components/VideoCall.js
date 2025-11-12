"use client";

import React, { useEffect, useRef, useState } from "react";

export default function VideoCall({ conversation, xmtpClient, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeCall();
    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate && conversation) {
          // Send ICE candidate via XMTP
          await conversation.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
            })
          );
        }
      };

      setPeerConnection(pc);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via XMTP
      if (conversation) {
        await conversation.send(
          JSON.stringify({
            type: "offer",
            offer: offer,
          })
        );
      }

      setIsCallActive(true);
    } catch (err) {
      console.error("Call initialization error:", err);
      setError("Failed to initialize call: " + err.message);
    }
  };

  // Listen for WebRTC messages via XMTP
  useEffect(() => {
    if (!conversation || !peerConnection) return;

    let messageStream = null;
    let cancelled = false;

    const setupMessageListener = async () => {
      try {
        // Stream messages from the conversation
        if (conversation && typeof conversation.streamMessages === 'function') {
          messageStream = await conversation.streamMessages();
          
          for await (const message of messageStream) {
            if (cancelled) break;
            
            try {
              const data = JSON.parse(message.content);

              if (data.type === "offer" && peerConnection) {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(data.offer)
                );
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                if (conversation) {
                  await conversation.send(
                    JSON.stringify({
                      type: "answer",
                      answer: answer,
                    })
                  );
                }
              } else if (data.type === "answer" && peerConnection) {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription(data.answer)
                );
              } else if (data.type === "ice-candidate" && peerConnection) {
                await peerConnection.addIceCandidate(
                  new RTCIceCandidate(data.candidate)
                );
              }
            } catch (err) {
              // Not a WebRTC message, ignore
              console.debug("Non-WebRTC message:", err);
            }
          }
        }
      } catch (err) {
        console.error("WebRTC message stream error:", err);
      }
    };

    setupMessageListener();

    return () => {
      cancelled = true;
      if (messageStream && typeof messageStream.return === 'function') {
        messageStream.return();
      }
    };
  }, [conversation, peerConnection]);

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      peerConnection.close();
    }
  };

  const endCall = () => {
    cleanup();
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh]">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-4 right-4 w-64 h-48 rounded-lg overflow-hidden border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={endCall}
            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-full text-white font-bold"
          >
            End Call
          </button>
        </div>

        {error && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

