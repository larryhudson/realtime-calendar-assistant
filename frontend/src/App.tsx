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

const fetchOpenAISession = async (): Promise<any> => {
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
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleStartConversation = async (): Promise<void> => {
    setError(undefined);
    setSessionToken(undefined);
    try {
      const data = await fetchOpenAISession();
      // Avoid optional chaining for linter
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
      // TODO: Use the session token to establish WebRTC connection and handle audio (see #4)
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Unknown error");
      }
    }
    setIsConversing(true);
  };

  const handleStopConversation = (): void => {
    setIsConversing(false);
    // TODO: Clean up WebRTC connection and audio streams
  };

  let conversationButton;
  if (isConversing) {
    conversationButton = (
      <Button variant="primary" onPress={handleStopConversation} isDisabled>
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
