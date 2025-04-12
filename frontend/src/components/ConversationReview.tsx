import React, { useState } from "react";
import { Heading, View, ListView, Item, Text, Divider, Content, ProgressCircle } from "@adobe/react-spectrum";
import { useConversations } from "../hooks/useConversations";

/**
 * ConversationReview
 * 
 * UI for reviewing conversations, audio recordings, transcriptions, and notes/comments.
 * This is the entry point for the evaluation tools frontend.
 */
export default function ConversationReview() {
  const { conversations, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

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
        {selectedConversation && (
          <View marginTop="size-300" backgroundColor="static-gray-50" padding="size-200" borderRadius="regular">
            <Heading level={3}>
              {selectedConversation.title
                ? selectedConversation.title
                : `Conversation ${selectedConversation.id}`}
            </Heading>
            <Text>
              <strong>Created:</strong>{" "}
              {new Date(selectedConversation.created_at).toLocaleString()}
            </Text>
            {/* TODO: Display audio recordings, transcriptions, and notes/comments */}
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
