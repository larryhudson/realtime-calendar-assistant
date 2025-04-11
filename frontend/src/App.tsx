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
  TextArea,
  DatePicker,
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

import { parseDate } from "@internationalized/date";
import EventList from "./EventList";

type Event = {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
};

type EventForm = {
  title: string;
  description: string;
  startDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endDate: string;   // yyyy-mm-dd
  endTime: string;   // HH:mm
};

const INITIAL_EVENT_FORM: EventForm = {
  title: "",
  description: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
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

  // State for event form and dialog
  const [eventForm, setEventForm] = useState<EventForm>(INITIAL_EVENT_FORM);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  // State for events list
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | undefined>(undefined);

  // Fetch events from backend
  const fetchEvents = async () => {
    setEventsLoading(true);
    setEventsError(undefined);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("Failed to fetch events: " + res.statusText);
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setEventsError(
        err instanceof Error ? err.message : "Unknown error fetching events"
      );
    } finally {
      setEventsLoading(false);
    }
  };

  // Fetch events on mount
  React.useEffect(() => {
    fetchEvents();
  }, []);

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
                console.log({args})
                // Prefill event form state (if available in args)
                setEventForm((prev) => ({
                  ...prev,
                  title: args.title || "",
                  description: args.description || "",
                  startDate: args.start_time ? args.start_time.slice(0, 10) : "",
                  startTime: args.start_time ? args.start_time.slice(11, 16) : "",
                  endDate: args.end_time ? args.end_time.slice(0, 10) : "",
                  endTime: args.end_time ? args.end_time.slice(11, 16) : "",
                }));
                setEventDialogOpen(true);
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

  // Handlers for event form dialog
  const handleEventFormChange = (field: keyof EventForm, value: string) => {
    setEventForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCloseEventDialog = () => {
    setEventDialogOpen(false);
  };

  // Save event to backend
  const handleSaveEvent = async () => {
    // Basic validation
    if (
      !eventForm.title ||
      !eventForm.startDate ||
      !eventForm.startTime ||
      !eventForm.endDate ||
      !eventForm.endTime
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    // Combine date and time into ISO 8601 strings
    const start_time = `${eventForm.startDate}T${eventForm.startTime}:00`;
    const end_time = `${eventForm.endDate}T${eventForm.endTime}:00`;

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventForm.title,
          description: eventForm.description,
          start_time,
          end_time,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to create event: " + res.statusText);
      }
      // Optionally, you could use the returned event here
      setEventDialogOpen(false);
      setEventForm(INITIAL_EVENT_FORM);
      setError(undefined);
      // Refresh events list after saving
      fetchEvents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unknown error creating event"
      );
    }
  };

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
            contextualHelp="Enter your name"
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

          {/* Inline Calendar Event Form (shown when eventDialogOpen is true) */}
          {eventDialogOpen && (
            <View
              borderWidth="thin"
              borderColor="dark"
              padding="size-200"
              marginTop="size-200"
              backgroundColor="gray-50"
              maxWidth="size-3600"
              width="100%"
            >
              <Heading level={2}>Prefilled Calendar Event</Heading>
              <Flex direction="column" gap="size-200">
                <TextField
                  label="Title"
                  value={eventForm.title}
                  onChange={(v) => handleEventFormChange("title", v)}
                />
                <TextArea
                  label="Description"
                  value={eventForm.description}
                  onChange={(v) => handleEventFormChange("description", v)}
                />
                <DatePicker
                  label="Start Date"
                  value={eventForm.startDate ? parseDate(eventForm.startDate) : null}
                  onChange={(value) =>
                    handleEventFormChange("startDate", value ? value.toString() : "")
                  }
                />
                <TextField
                  label="Start Time (HH:mm)"
                  value={eventForm.startTime}
                  onChange={(v) => handleEventFormChange("startTime", v)}
                />
                <DatePicker
                  label="End Date"
                  value={eventForm.endDate ? parseDate(eventForm.endDate) : null}
                  onChange={(value) =>
                    handleEventFormChange("endDate", value ? value.toString() : "")
                  }
                />
                <TextField
                  label="End Time (HH:mm)"
                  value={eventForm.endTime}
                  onChange={(v) => handleEventFormChange("endTime", v)}
                />
                <Flex direction="row" gap="size-200">
                  <Button variant="primary" onPress={handleSaveEvent}>
                    Save Event
                  </Button>
                  <Button variant="secondary" onPress={handleCloseEventDialog}>
                    Close
                  </Button>
                </Flex>
              </Flex>
            </View>
          )}
        </Flex>
        <EventList events={events} loading={eventsLoading} error={eventsError} />
      </View>
    </Provider>
  );
};

export default App;
