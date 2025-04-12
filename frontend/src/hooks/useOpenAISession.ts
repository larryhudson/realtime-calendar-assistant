import { useRef, useState } from "react";

type OpenAISessionResponse = {
  client_secret: {
    value: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

async function fetchOpenAISession(): Promise<OpenAISessionResponse> {
  const res = await fetch("/api/openai/session");
  if (!res.ok) {
    throw new Error("Failed to fetch OpenAI session: " + res.statusText);
  }
  return await res.json();
}

export function useOpenAISession(
  onFunctionCall?: (args: any) => void
) {
  const [isConversing, setIsConversing] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Start conversation and establish WebRTC connection
  const handleStartConversation = async () => {
    setError(undefined);
    setSessionToken(undefined);
    setPeerConnection(null);
    setLocalStream(null);
    try {
      const data = await fetchOpenAISession();
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

      // 2. Set up to play remote audio from the model
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

      // Function schema for calendar event creation
      const calendarEventFunction = {
        type: "function",
        name: "create_calendar_event",
        description: "Create a calendar event with structured data.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event title" },
            description: { type: "string", description: "Event description" },
            start_time: { type: "string", description: "Event start time (ISO 8601)" },
            end_time: { type: "string", description: "Event end time (ISO 8601)" }
          },
          required: ["title", "start_time", "end_time"]
        }
      };

      // Prefill event form when function_call is received
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
                item.name === "create_calendar_event" &&
                typeof item.arguments === "string"
              ) {
                const args = JSON.parse(item.arguments);
                if (onFunctionCall) onFunctionCall(args);
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      // After connection, send session.update to register the function
      dc.addEventListener("open", () => {
        const sessionUpdate = {
          type: "session.update",
          session: {
            tools: [calendarEventFunction],
            tool_choice: "auto"
          }
        };
        dc.send(JSON.stringify(sessionUpdate));
      });

      // 5. Start the session using SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
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
