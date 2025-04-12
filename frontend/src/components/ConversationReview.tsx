import React, { useState } from "react";
import { Heading, View, ListView, Item, Text, Divider, Content, ProgressCircle } from "@adobe/react-spectrum";
import { useConversations } from "../hooks/useConversations";

/**
 * ConversationReview
 * 
 * UI for reviewing conversations, audio recordings, transcriptions, and notes/comments.
 * This is the entry point for the evaluation tools frontend.
 */
import { useConversationAudio } from "../hooks/useConversationAudio";
import { useConversationTranscriptions } from "../hooks/useConversationTranscriptions";
import { useConversationNotes } from "../hooks/useConversationNotes";

import { useAddConversationNote } from "../hooks/useAddConversationNote";
import { TextField, TextArea, Button, Flex } from "@adobe/react-spectrum";

function NotesPanel({ conversationId }: { conversationId: number }) {
  const { addNote, loading: adding, error: addError, success } = useAddConversationNote(conversationId);

  const [content, setContent] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [author, setAuthor] = useState("");

  // Refresh notes after successful add
  React.useEffect(() => {
    if (success) {
      setContent("");
      setTimestamp("");
      setAuthor("");
    }
  }, [success]);

  // Re-fetch notes after successful add
  const { notes: refreshedNotes, loading: refreshedLoading, error: refreshedError } = useConversationNotes(conversationId);

  return (
    <View>
      <Heading level={4}>Notes & Comments</Heading>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!content.trim() || !timestamp.trim()) return;
          await addNote({
            content,
            timestamp,
            author: author.trim() ? author : undefined,
          });
        }}
        style={{ marginBottom: 16 }}
      >
        <Flex direction="column" gap="size-100">
          <TextArea
            label="Comment"
            value={content}
            onChange={setContent}
            isRequired
            width="100%"
            minWidth={300}
            maxWidth={600}
          />
          <TextField
            label="Timestamp (seconds into audio)"
            value={timestamp}
            onChange={setTimestamp}
            isRequired
            width="size-2000"
            minWidth={200}
            maxWidth={400}
            placeholder="e.g. 12.5"
          />
          <TextField
            label="Author"
            value={author}
            onChange={setAuthor}
            width="size-2000"
            minWidth={200}
            maxWidth={400}
            placeholder="Optional"
          />
          <Button type="submit" variant="primary" isDisabled={adding || !content.trim() || !timestamp.trim()}>
            {adding ? "Adding..." : "Add Comment"}
          </Button>
          {addError && <Text UNSAFE_style={{ color: "red" }}>Error: {addError}</Text>}
          {success && <Text UNSAFE_style={{ color: "green" }}>Comment added!</Text>}
        </Flex>
      </form>
      {refreshedLoading ? (
        <ProgressCircle aria-label="Loading notes…" isIndeterminate size="S" />
      ) : refreshedError ? (
        <div style={{ color: "red" }}>
          <Text>Error: {refreshedError}</Text>
        </div>
      ) : refreshedNotes.length === 0 ? (
        <Text>No notes or comments for this conversation.</Text>
      ) : (
        <View>
          {refreshedNotes.map((note) => (
            <View key={note.id} marginBottom="size-150">
              <Text>
                <strong>{note.author ? note.author : "Anonymous"}</strong> —{" "}
                <span style={{ color: "#888" }}>
                  {isFinite(Number(note.timestamp))
                    ? `${Number(note.timestamp)}s`
                    : note.timestamp}
                </span>
              </Text>
              <View backgroundColor="static-white" padding="size-100" borderRadius="small" marginTop="size-50">
                <Text>{note.content}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TranscriptionsPanel({ conversationId }: { conversationId: number }) {
  const { transcriptions, loading, error } = useConversationTranscriptions(conversationId);

  return (
    <View>
      <Heading level={4}>Transcriptions</Heading>
      {loading ? (
        <ProgressCircle aria-label="Loading transcriptions…" isIndeterminate size="S" />
      ) : error ? (
        <div style={{ color: "red" }}>
          <Text>Error: {error}</Text>
        </div>
      ) : transcriptions.length === 0 ? (
        <Text>No transcriptions found for this conversation.</Text>
      ) : (
        <View>
          {transcriptions.map((t) => (
            <View key={t.id} marginBottom="size-150">
              <Text>
                <strong>Audio #{t.audio_id}</strong> —{" "}
                <span style={{ color: "#888" }}>
                  {new Date(t.created_at).toLocaleString()}
                </span>
              </Text>
              <View backgroundColor="static-white" padding="size-100" borderRadius="small" marginTop="size-50">
                <Text>{t.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function AudioRecordings({ conversationId }: { conversationId: number }) {
  const { audio, loading, error } = useConversationAudio(conversationId);

  return (
    <View>
      <Heading level={4}>Audio Recordings</Heading>
      {loading ? (
        <ProgressCircle aria-label="Loading audio recordings…" isIndeterminate size="S" />
      ) : error ? (
        <div style={{ color: "red" }}>
          <Text>Error: {error}</Text>
        </div>
      ) : audio.length === 0 ? (
        <Text>No audio recordings found for this conversation.</Text>
      ) : (
        <View>
          {audio.map((rec) => (
            <View key={rec.id} marginBottom="size-150">
              <Text>
                <strong>{rec.file_path}</strong> —{" "}
                <span style={{ color: "#888" }}>
                  {new Date(rec.created_at).toLocaleString()}
                </span>
              </Text>
              <audio controls src={rec.url} style={{ display: "block", marginTop: 4, width: "100%" }} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

type ConversationDetails = {
  id: number;
  title: string | null;
  created_at: string;
  prompt_name?: string;
  prompt_text?: string;
  // Add any other fields as needed
};

function isConversationWithPromptDetails(
  conv: unknown
): conv is ConversationDetails & { prompt_name: string; prompt_text: string } {
  if (typeof conv !== "object" || conv === null) return false;
  const obj = conv as { [key: string]: unknown };
  return (
    typeof obj.prompt_name === "string" &&
    !!obj.prompt_name
  );
}

export default function ConversationReview() {
  const { conversations, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Store details loaded from /api/conversations/:id
  const [selectedConversationDetails, setSelectedConversationDetails] = useState<ConversationDetails | null>(null);
  const selectedConversation = conversations.find((c) => c.id === selectedId);

  // Fetch details when selectedId changes
  React.useEffect(() => {
    if (selectedId == null) {
      setSelectedConversationDetails(null);
      return;
    }
    let cancelled = false;
    setSelectedConversationDetails(null);
    fetch(`/api/conversations/${selectedId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data) setSelectedConversationDetails(data);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Prefer details from API if loaded, else fallback to list
  const conversationToShow = selectedConversationDetails || selectedConversation;

  return (
    <View padding="size-200">
      <Heading level={2}>Conversation Review & Evaluation</Heading>
      <Divider marginY="size-200" />
      <Content>
        <Text>
          Select a conversation to review audio recordings, transcriptions, and add notes/comments for evaluation.
        </Text>
        <View marginTop="size-200" maxWidth="size-3400">
          {loading ? (
            <ProgressCircle aria-label="Loading conversations…" isIndeterminate />
          ) : error ? (
            <div style={{ color: "red" }}>
              <Text>Error: {error}</Text>
            </div>
          ) : (
            <ListView
              aria-label="Conversations"
              selectionMode="single"
              selectedKeys={selectedId !== null ? [selectedId.toString()] : []}
              onSelectionChange={(keys) => {
                const id = Array.from(keys)[0];
                setSelectedId(id !== undefined ? Number(id) : null);
              }}
            >
              {conversations.length === 0 ? (
                <Item key="placeholder">No conversations found.</Item>
              ) : (
                conversations.map((conv) => (
                  <Item key={conv.id}>
                    <Text>
                      {conv.title ? conv.title : `Conversation ${conv.id}`}
                      {" — "}
                      <span style={{ color: "#888" }}>
                        {new Date(conv.created_at).toLocaleString()}
                      </span>
                    </Text>
                  </Item>
                ))
              )}
            </ListView>
          )}
        </View>
        {conversationToShow && (
          <View marginTop="size-300" backgroundColor="static-gray-50" padding="size-200" borderRadius="regular">
            <Heading level={3}>
              {conversationToShow.title
                ? conversationToShow.title
                : `Conversation ${conversationToShow.id}`}
            </Heading>
            <Text>
              <strong>Created:</strong>{" "}
              {new Date(conversationToShow.created_at).toLocaleString()}
            </Text>
            {isConversationWithPromptDetails(conversationToShow) && (
              <View marginTop="size-150" marginBottom="size-150">
                <Text>
                  <strong>Prompt:</strong> {conversationToShow.prompt_name}
                </Text>
                <View backgroundColor="static-white" padding="size-100" borderRadius="small" marginTop="size-50">
                  <Text>{conversationToShow.prompt_text}</Text>
                </View>
              </View>
            )}
            <Divider marginY="size-200" />
            {/* Audio Recordings */}
            <AudioRecordings conversationId={conversationToShow.id} />
            <Divider marginY="size-200" />
            {/* Transcriptions */}
            <TranscriptionsPanel conversationId={conversationToShow.id} />
            <Divider marginY="size-200" />
            {/* Notes/Comments */}
            <NotesPanel conversationId={conversationToShow.id} />
            <Divider marginY="size-200" />
            <Text>
              Conversation details and evaluation tools will appear here.
            </Text>
          </View>
        )}
      </Content>
    </View>
  );
}
