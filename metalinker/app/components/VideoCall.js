"use client";

import React, { useEffect, useRef, useState } from "react";

export default function VideoCall({ conversation, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState("initial");
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const connectionTimeoutRef = useRef(null);
  const iceCandidatesRef = useRef([]); // Buffer for ICE candidates
  const remoteDescriptionSetRef = useRef(false);

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
            setHasRemoteStream(true);
          }
        };

        // Monitor connection state
        nextPeerConnection.onconnectionstatechange = () => {
          const state = nextPeerConnection.connectionState;
          console.log("Connection state:", state);
          setConnectionState(state);

          if (state === "failed") {
            setError("Connection failed. Please check your network and try again.");
          } else if (state === "disconnected") {
            setError("Connection lost. Attempting to reconnect...");
          } else if (state === "connected") {
            setError(null);
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
            }
          }
        };

        // Monitor ICE connection state
        nextPeerConnection.oniceconnectionstatechange = () => {
          const state = nextPeerConnection.iceConnectionState;
          console.log("ICE connection state:", state);

          if (state === "failed") {
            setError("ICE connection failed. Check NAT/firewall settings.");
          } else if (state === "disconnected") {
            console.warn("ICE disconnected");
          } else if (state === "checking") {
            setConnectionState("connecting");
          }
        };

        // Monitor ICE gathering state
        nextPeerConnection.onicegatheringstatechange = () => {
          console.log("ICE gathering state:", nextPeerConnection.iceGatheringState);
        };

        nextPeerConnection.onicecandidate = async (event) => {
          if (!event.candidate || !conversation) {
            return;
          }

          try {
            const candidateData = {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            };

            console.log("Sending ICE candidate:", candidateData);
            await conversation.send(
              JSON.stringify({
                type: "ice-candidate",
                candidate: candidateData,
              })
            );
          } catch (err) {
            console.error("Error sending ICE candidate:", err);
          }
        };

        if (conversation) {
          try {
            const offer = await nextPeerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await nextPeerConnection.setLocalDescription(offer);

            console.log("Sending offer");
            await conversation.send(
              JSON.stringify({
                type: "offer",
                offer: {
                  type: offer.type,
                  sdp: offer.sdp,
                },
              })
            );
            console.log("Offer sent successfully");

            // Set timeout for connection establishment
            connectionTimeoutRef.current = setTimeout(() => {
              if (
                nextPeerConnection.connectionState !== "connected" &&
                nextPeerConnection.connectionState !== "completed"
              ) {
                setError("Connection timeout. The other party may be offline.");
              }
            }, 30000); // 30 second timeout
          } catch (err) {
            console.error("Error creating/sending offer:", err);
            setError(`Failed to create offer: ${err.message}`);
          }
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
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [conversation]);

  // Helper function to add buffered ICE candidates
  const flushIceCandidates = async (pc) => {
    console.log(`Flushing ${iceCandidatesRef.current.length} buffered ICE candidates`);
    const candidates = iceCandidatesRef.current;
    iceCandidatesRef.current = [];

    for (const candidateData of candidates) {
      try {
        const iceCandidate = new RTCIceCandidate(candidateData);
        await pc.addIceCandidate(iceCandidate);
      } catch (err) {
        console.debug("Error adding buffered ICE candidate:", err.message);
      }
    }
  };

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
              console.log("Received offer, setting remote description");
              try {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription({
                    type: "offer",
                    sdp: data.offer.sdp || data.offer,
                  })
                );
                remoteDescriptionSetRef.current = true;

                // Flush buffered ICE candidates
                await flushIceCandidates(peerConnection);

                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                const sentAnswer = await conversation.send(
                  JSON.stringify({
                    type: "answer",
                    answer: {
                      type: answer.type,
                      sdp: answer.sdp,
                    },
                  })
                );
                console.log("Answer sent successfully");
              } catch (err) {
                console.error("Error handling offer:", err);
                setError(`Error handling offer: ${err.message}`);
              }
            } else if (data.type === "answer") {
              console.log("Received answer, setting remote description");
              try {
                await peerConnection.setRemoteDescription(
                  new RTCSessionDescription({
                    type: "answer",
                    sdp: data.answer.sdp || data.answer,
                  })
                );
                remoteDescriptionSetRef.current = true;

                // Flush buffered ICE candidates
                await flushIceCandidates(peerConnection);
              } catch (err) {
                console.error("Error handling answer:", err);
                setError(`Error handling answer: ${err.message}`);
              }
            } else if (data.type === "ice-candidate") {
              if (!remoteDescriptionSetRef.current) {
                // Buffer ICE candidate until remote description is set
                console.log("Buffering ICE candidate (remote description not yet set)");
                iceCandidatesRef.current.push(data.candidate);
              } else {
                // Directly add ICE candidate if remote description is already set
                try {
                  const iceCandidate = new RTCIceCandidate(data.candidate);
                  await peerConnection.addIceCandidate(iceCandidate);
                  console.log("ICE candidate added");
                } catch (err) {
                  console.debug("Error adding ICE candidate:", err.message);
                }
              }
            }
          } catch (err) {
            // Ignore non-WebRTC XMTP messages
            console.debug("Non-WebRTC message or parsing error:", err.message);
          }
        }
      } catch (err) {
        console.error("WebRTC message stream error:", err);
      }
    })();

    return () => {
      cancelled = true;
      messageStream?.return?.();
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
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
        {hasRemoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <p className="text-white text-xl mb-4">
                {connectionState === "initial" || connectionState === "connecting"
                  ? "Connecting..."
                  : "Waiting for remote video..."}
              </p>
              {connectionState === "connected" || connectionState === "completed" ? (
                <p className="text-green-400 text-sm">Connected - Waiting for video</p>
              ) : (
                <p className="text-yellow-400 text-sm">
                  State: {connectionState}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 w-64 h-48 rounded-lg overflow-hidden border-2 border-white bg-gray-900">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!localStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <p className="text-white text-xs">Loading camera...</p>
            </div>
          )}
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
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded max-w-md">
            {error}
          </div>
        )}

        {connectionState && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-gray-200 px-3 py-1 rounded text-xs">
            {connectionState}
          </div>
        )}
      </div>
    </div>
  );
}
