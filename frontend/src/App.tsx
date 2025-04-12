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
import { calendarEventTool, isCalendarEventFunctionArgs, getEventFormFromFunctionArgs } from "./tools/calendarEventTool";
import { useEvents } from "./hooks/useEvents";
import { ModelSelector, OpenAIModel } from "./components/ModelSelector";
import { PromptSelector } from "./components/PromptSelector";
import ConversationReview from "./components/ConversationReview";
import { useUploadConversationAudio } from "./hooks/useUploadConversationAudio";

const DEFAULT_INSTRUCTIONS =
  "You are a helpful, witty, and friendly AI assistant. Act like a human but remember that you aren't a human and that you can't do human things in the real world. Your voice and personality should be warm and engaging with a lively and playful tone.";

const App: React.FC = () => {
  // Debug log state
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function logDebug(message: string) {
    setDebugLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }
  // Model selector state
  const [selectedModel, setSelectedModel] = useState<OpenAIModel>("gpt-4o-realtime-preview-2024-12-17");
  // Instructions state
  const [instructions, setInstructions] = useState<string>(DEFAULT_INSTRUCTIONS);
  // Track selected prompt version
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState<number | null>(null);

  // Event form and dialog state/logic
  const {
    eventForm,
    eventDialogOpen,
    openEventDialog,
    closeEventDialog,
    handleEventFormChange,
    resetEventForm,
  } = useEventForm();


  // Handler for OpenAI tool invocations
  const handleOpenAITool = (toolName: string, args: unknown) => {
    if (toolName === "create_calendar_event" && isCalendarEventFunctionArgs(args)) {
      openEventDialog(getEventFormFromFunctionArgs(args));
    }
    // Future: handle other tool types here
  };

  // Conversation state
  const [conversationId, setConversationId] = useState<number | null>(null);

  // Audio upload logic (use current conversationId)
  const { uploadAudio, uploading, error: uploadError, success: uploadSuccess } = useUploadConversationAudio(conversationId);

  // Track audio upload state for debug log
  React.useEffect(() => {
    if (uploading) logDebug("Audio uploading...");
  }, [uploading]);
  React.useEffect(() => {
    if (uploadSuccess) logDebug("Audio uploaded successfully.");
  }, [uploadSuccess]);
  React.useEffect(() => {
    if (uploadError) logDebug(`Audio upload error: ${uploadError}`);
  }, [uploadError]);

  // OpenAI session and conversation logic
  const {
    isConversing,
    sessionToken,
    error,
    audioRef,
    handleStartConversation,
    handleStopConversation,
  } = useOpenAISession({
    onFunctionCall: handleOpenAITool,
    tools: [calendarEventTool],
    model: selectedModel,
    instructions,
    onAudioReady: (audio: Blob, filename: string) => {
      console.log("Inside onAudioReady callback", { audio, filename, conversationId });
      if (conversationId) {
        logDebug("Audio ready, starting upload...");
        uploadAudio(audio, filename);
      }
    }
  });

  // Stop conversation logic: just stop and log, do not create a new conversation
  const handleStopConversationWithLog = () => {
    handleStopConversation();
    logDebug("Conversation stopped.");
  };

  // Events state and logic
  const { events, eventsLoading, eventsError, refreshEvents } = useEvents();

  // Local state for event form validation errors
  const [formError, setFormError] = useState<string | undefined>(undefined);

  // New: Start conversation logic - create conversation, then start session
  const handleStartConversationWithCreate = async () => {
    logDebug("Creating conversation...");
    try {
      const body: Record<string, any> = { title: "New Conversation" };
      if (selectedPromptVersionId) {
        body.prompt_version_id = selectedPromptVersionId;
      }
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
        logDebug(`Conversation created with id ${data.id}.`);
        // handleStartConversation will be triggered by useEffect below
      } else {
        setConversationId(null);
        logDebug("Failed to create conversation.");
      }
    } catch {
      setConversationId(null);
      logDebug("Error creating conversation.");
    }
  };

  // Start OpenAI session only after conversationId is set
  React.useEffect(() => {
    if (conversationId && !isConversing) {
      handleStartConversation();
      logDebug("Conversation started.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  let conversationButton;
  if (isConversing) {
    conversationButton = (
      <Button variant="primary" onPress={handleStopConversationWithLog}>
        Stop Conversation
      </Button>
    );
  } else {
    conversationButton = (
      <Button
        variant="primary"
        onPress={handleStartConversationWithCreate}
      >
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

          <PromptSelector
            value={instructions}
            onChange={setInstructions}
            disabled={isConversing}
            onPromptVersionIdChange={setSelectedPromptVersionId}
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

          {/* Audio upload status */}
          {uploading && <p>Uploading conversation audio...</p>}
          {uploadError && <p style={{ color: "red" }}>Audio upload error: {uploadError}</p>}
          {uploadSuccess && <p style={{ color: "green" }}>Audio uploaded successfully!</p>}
        </Flex>
        {/* Debug log output */}
        <View marginTop="size-200" backgroundColor="static-gray-100" padding="size-200" borderRadius="regular">
          <Heading level={4}>Debug Log</Heading>
          <pre style={{ maxHeight: 200, overflow: "auto", fontSize: 12 }}>
            {debugLog.join("\n")}
          </pre>
        </View>
        <EventList events={events} loading={eventsLoading} error={eventsError} />
        <ConversationReview />
      </View>
    </Provider>
  );
};

export default App;
