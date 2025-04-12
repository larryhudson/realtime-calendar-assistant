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
import { useEvents } from "./hooks/useEvents";

const App: React.FC = () => {
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
  } = useOpenAISession((args) => {
    // Prefill event form when function_call is received
    openEventDialog({
      title: args.title || "",
      description: args.description || "",
      startDate: args.start_time ? args.start_time.slice(0, 10) : "",
      startTime: args.start_time ? args.start_time.slice(11, 16) : "",
      endDate: args.end_time ? args.end_time.slice(0, 10) : "",
      endTime: args.end_time ? args.end_time.slice(11, 16) : "",
    });
  });

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
