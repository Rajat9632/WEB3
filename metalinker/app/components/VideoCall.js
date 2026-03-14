"use client";

import React, { useEffect, useRef, useState } from "react";

export default function VideoCall({ conversation, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let activeStream = null;
    let activePeerConnection = null;

    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        activeStream = mediaStream;
        setLocalStream(mediaStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        const nextPeerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });

        activePeerConnection = nextPeerConnection;
        setPeerConnection(nextPeerConnection);

        mediaStream.getTracks().forEach((track) => {
          nextPeerConnection.addTrack(track, mediaStream);
        });

        nextPeerConnection.ontrack = (event) => {
          const [remoteStream] = event.streams;

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        };

        nextPeerConnection.onicecandidate = async (event) => {
          if (!event.candidate || !conversation) {
            return;
          }

          await conversation.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
            })
          );
        };

        if (conversation) {
          const offer = await nextPeerConnection.createOffer();
          await nextPeerConnection.setLocalDescription(offer);
          await conversation.send(
            JSON.stringify({
              type: "offer",
              offer,
            })
          );
        }
      } catch (err) {
        console.error("Call initialization error:", err);
        setError(`Failed to initialize call: ${err.message}`);
      }
    })();

    return () => {
      mounted = false;
      activeStream?.getTracks().forEach((track) => track.stop());
      activePeerConnection?.close();
    };
  }, [conversation]);

  useEffect(() => {
    if (!conversation || !peerConnection) {
      return;
    }

    let cancelled = false;
    let messageStream = null;

    (async () => {
      try {
        messageStream = await conversation.stream();

        for await (const message of messageStream) {
          if (cancelled || typeof message.content !== "string") {
            continue;
          }

          try {
            const data = JSON.parse(message.content);

            if (data.type === "offer") {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);
              await conversation.send(
                JSON.stringify({
                  type: "answer",
                  answer,
                })
              );
            } else if (data.type === "answer") {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
            } else if (data.type === "ice-candidate") {
              await peerConnection.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            }
          } catch {
            // Ignore non-WebRTC XMTP messages.
          }
        }
      } catch (err) {
        console.error("WebRTC message stream error:", err);
      }
    })();

    return () => {
      cancelled = true;
      messageStream?.return?.();
    };
  }, [conversation, peerConnection]);

  const endCall = () => {
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnection?.close();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh]">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        <div className="absolute bottom-4 right-4 w-64 h-48 rounded-lg overflow-hidden border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

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
