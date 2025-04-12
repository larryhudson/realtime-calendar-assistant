import React from "react";
import { useState } from "react";
import {
  Button,
  Flex,
  Heading,
  Provider,
  View,
  defaultTheme,
} from "@adobe/react-spectrum";

import EventList from "./EventList";
import { useEventForm } from "./hooks/useEventForm";
import EventFormDialog from "./components/EventFormDialog";
import { useOpenAISession } from "./hooks/useOpenAISession";
import { calendarEventTool, isCalendarEventFunctionArgs } from "./tools/calendarEventTool";
import { useEvents } from "./hooks/useEvents";
import { ModelSelector, OpenAIModel } from "./components/ModelSelector";
import { InstructionsEditor } from "./components/InstructionsEditor";

const DEFAULT_INSTRUCTIONS =
  "You are a helpful, witty, and friendly AI assistant. Act like a human but remember that you aren't a human and that you can't do human things in the real world. Your voice and personality should be warm and engaging with a lively and playful tone.";

const App: React.FC = () => {
  // Model selector state
  const [selectedModel, setSelectedModel] = useState<OpenAIModel>("gpt-4o-realtime-preview-2024-12-17");
  // Instructions state
  const [instructions, setInstructions] = useState<string>(DEFAULT_INSTRUCTIONS);

  // Event form and dialog state/logic
  const {
    eventForm,
    eventDialogOpen,
    openEventDialog,
    closeEventDialog,
    handleEventFormChange,
    resetEventForm,
  } = useEventForm();


  // OpenAI session and conversation logic
  const {
    isConversing,
    sessionToken,
    error,
    audioRef,
    handleStartConversation,
    handleStopConversation,
  } = useOpenAISession(
    (toolName, args) => {
      if (toolName === "create_calendar_event" && isCalendarEventFunctionArgs(args)) {
        openEventDialog({
          title: args.title || "",
          description: args.description || "",
          startDate: args.start_time ? args.start_time.slice(0, 10) : "",
          startTime: args.start_time ? args.start_time.slice(11, 16) : "",
          endDate: args.end_time ? args.end_time.slice(0, 10) : "",
          endTime: args.end_time ? args.end_time.slice(11, 16) : "",
        });
      }
      // Future: handle other tool types here
    },
    [calendarEventTool],
    selectedModel,
    instructions
  );

  // Events state and logic
  const { events, eventsLoading, eventsError, refreshEvents } = useEvents();

  // Local state for event form validation errors
  const [formError, setFormError] = useState<string | undefined>(undefined);

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
      setFormError("Please fill in all required fields.");
      return;
    }
    setFormError(undefined);
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
        setFormError("Failed to create event: " + res.statusText);
        return;
      }
      // Optionally, you could use the returned event here
      closeEventDialog();
      resetEventForm();
      // Refresh events list after saving
      refreshEvents();
    } catch (err) {
      setFormError(
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

          <ModelSelector
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={isConversing}
          />

          <InstructionsEditor
            value={instructions}
            onChange={setInstructions}
            disabled={isConversing}
          />

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

          {/* Calendar Event Form Dialog */}
          <EventFormDialog
            eventForm={eventForm}
            eventDialogOpen={eventDialogOpen}
            onChange={handleEventFormChange}
            onSave={handleSaveEvent}
            onClose={closeEventDialog}
            error={formError}
          />
        </Flex>
        <EventList events={events} loading={eventsLoading} error={eventsError} />
      </View>
    </Provider>
  );
};

export default App;
