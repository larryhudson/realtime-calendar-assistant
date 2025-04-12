import { useRef, useState } from "react";

type OpenAISessionResponse = {
  client_secret: {
    value: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

async function fetchOpenAISession(model: string): Promise<OpenAISessionResponse> {
  const url = `/api/openai/session?model=${encodeURIComponent(model)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch OpenAI session: " + res.statusText);
  }
  return await res.json();
}

// Generic function call handler type
export type OpenAIToolFunctionCallHandler = (toolName: string, args: unknown) => void;

// Tool schema type (loosely matches OpenAI function tool schema)
export type OpenAIToolSchema = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

interface UseOpenAISessionOptions {
  onFunctionCall: OpenAIToolFunctionCallHandler;
  tools: OpenAIToolSchema[];
  model?: string;
  instructions?: string;
  onAudioReady?: (audio: Blob, filename: string) => void;
}

export function useOpenAISession({
  onFunctionCall,
  tools,
  model = "gpt-4o-realtime-preview-2024-12-17",
  instructions = "",
  onAudioReady,
}: UseOpenAISessionOptions) {
  const [isConversing, setIsConversing] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Start conversation and establish WebRTC connection
  const handleStartConversation = async () => {
    setError(undefined);
    setSessionToken(undefined);
    setPeerConnection(null);
    setLocalStream(null);
    try {
      const data = await fetchOpenAISession(model);
      let token: string | undefined = undefined;
      if (
        data &&
        typeof data === "object" &&
        "client_secret" in data &&
        data.client_secret &&
        typeof data.client_secret === "object" &&
        "value" in data.client_secret
      ) {
        token = data.client_secret.value;
      }
      setSessionToken(token);

      if (!token) throw new Error("No ephemeral session token received");

      // 1. Create peer connection
      const pc = new RTCPeerConnection();

      // 2. Set up to play remote audio from the model and capture remote stream
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
        }
      };

      // 3. Add local audio track for microphone input
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(ms);
      pc.addTrack(ms.getTracks()[0]);

      // 4. Set up data channel for events (function calling, etc.)
      const dc = pc.createDataChannel("oai-events");

      // Listen for function_call messages for any registered tool
      dc.addEventListener("message", (e) => {
        try {
          const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
          // Listen for response.done with function_call output
          if (
            data?.type === "response.done" &&
            Array.isArray(data.response?.output)
          ) {
            for (const item of data.response.output) {
              if (
                item.type === "function_call" &&
                typeof item.name === "string" &&
                typeof item.arguments === "string"
              ) {
                const args = JSON.parse(item.arguments);
                if (onFunctionCall) onFunctionCall(item.name, args);
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      // After connection, send session.update to register the tools and instructions
      dc.addEventListener("open", () => {
        const sessionUpdate: {
          type: "session.update";
          session: {
            tools: OpenAIToolSchema[];
            tool_choice: string;
            instructions?: string;
          };
        } = {
          type: "session.update",
          session: {
            tools: tools,
            tool_choice: "auto"
          }
        };
        if (instructions && instructions.trim().length > 0) {
          sessionUpdate.session.instructions = instructions;
        }
        dc.send(JSON.stringify(sessionUpdate));
      });

      // 5. Start the session using SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const sdpResponse = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      setPeerConnection(pc);

      // --- AUDIO RECORDING SETUP ---
      // Wait for both localStream and remoteStream to be available
      // We'll use a small delay to ensure ontrack fires
      setTimeout(() => {
        const local = ms;
        const remote = audioRef.current?.srcObject as MediaStream | null;
        if (!local || !remote) return;

        // Create AudioContext and destination node
        const audioCtx =
          new (window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();
        destNodeRef.current = dest;

        // Connect local mic
        const localSource = audioCtx.createMediaStreamSource(local);
        localSource.connect(dest);

        // Connect remote model audio
        const remoteSource = audioCtx.createMediaStreamSource(remote);
        remoteSource.connect(dest);

        // Start MediaRecorder on the destination node's stream
        const recorder = new MediaRecorder(dest.stream);
        setMediaRecorder(recorder);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = async () => {
          console.log("[useOpenAISession] MediaRecorder onstop triggered, chunks:", chunks);
          // setAudioChunks(chunks);
          // Upload audio blob to backend
          if (chunks.length > 0 && onAudioReady) {
            const blob = new Blob(chunks, { type: "audio/webm" });
            console.log("[useOpenAISession] Calling onAudioReady with blob:", blob);
            onAudioReady(blob, "conversation.webm");
          } else {
            console.log("[useOpenAISession] No audio chunks or onAudioReady missing.");
          }
        };
        console.log("[useOpenAISession] Starting MediaRecorder...");
        recorder.start();
      }, 500);

    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unknown error");
      }
    }
    setIsConversing(true);
  };

  // Clean up WebRTC connection and audio streams
  const handleStopConversation = () => {
    setIsConversing(false);
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    if (mediaRecorder) {
      console.log("[useOpenAISession] Stopping MediaRecorder...");
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    destNodeRef.current = null;
    // setRemoteStream(null);
  };

  return {
    isConversing,
    sessionToken,
    error,
    audioRef,
    handleStartConversation,
    handleStopConversation,
  };
}
