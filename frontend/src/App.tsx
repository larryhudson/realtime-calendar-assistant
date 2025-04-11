import React from "react";
import { useRef, useState } from "react";
import {
  Button,
  Flex,
  Heading,
  Provider,
  TextField,
  View,
  defaultTheme,
} from "@adobe/react-spectrum";

const INITIAL_COUNT = 0;

type OpenAISessionResponse = {
  client_secret: {
    value: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const fetchOpenAISession = async (): Promise<OpenAISessionResponse> => {
  const res = await fetch("/api/openai/session");
  if (!res.ok) {
    throw new Error("Failed to fetch OpenAI session: " + res.statusText);
  }
  return await res.json();
};

const App: React.FC = () => {
  const [count, setCount] = useState<number>(INITIAL_COUNT);
  const [name, setName] = useState<string>("");
  const [isConversing, setIsConversing] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Establish WebRTC connection to OpenAI Realtime API
  const handleStartConversation = async (): Promise<void> => {
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

      // 4. Set up data channel for events (optional, for debugging)
      const dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", (e) => {
        console.log(e);
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
  const handleStopConversation = (): void => {
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

  let conversationButton;
  if (isConversing) {
    conversationButton = (
      <Button variant="primary" onPress={handleStopConversation}>
        Stop Conversation
      </Button>
    );
  } else {
    conversationButton = (
      <Button variant="primary" onPress={handleStartConversation}>
        Start Conversation
      </Button>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View padding="size-200">
        <Flex
          direction="column"
          gap="size-200"
          alignItems="start"
          maxWidth="size-3600"
        >
          <Heading level={1}>React Spectrum Demo</Heading>
          <TextField
            label="Your Name"
            value={name}
            onChange={setName}
            placeholder="Enter your name"
          />
          <Button variant="cta" onPress={() => setCount(count + 1)}>
            Count is {count}
          </Button>
          {name !== "" && <Heading level={3}>Hello, {name}!</Heading>}

          {conversationButton}
          <audio
            ref={audioRef}
            autoPlay
            controls
            style={{ display: "block", marginTop: 16 }}
          />
          {sessionToken !== undefined && (
            <View>
              <p style={{ wordBreak: "break-all" }}>
                <strong>Ephemeral Session Token:</strong> {sessionToken}
              </p>
            </View>
          )}
          {error !== undefined && (
            <View>
              <p style={{ color: "red" }}>{error}</p>
            </View>
          )}
        </Flex>
      </View>
    </Provider>
  );
};

export default App;
