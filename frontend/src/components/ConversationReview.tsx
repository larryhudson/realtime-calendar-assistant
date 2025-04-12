import React from "react";
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

  return (
    <View padding="size-200">
      <Heading level={2}>Conversation Review & Evaluation</Heading>
      <Divider marginY="size-200" />
      <Content>
        <Text>
          Select a conversation to review audio recordings, transcriptions, and add notes/comments for evaluation.
        </Text>
        {loading ? (
          <ProgressCircle aria-label="Loading conversations…" isIndeterminate />
        ) : error ? (
          <div style={{ color: "red" }}>
            <Text>Error: {error}</Text>
          </div>
        ) : (
          <ListView aria-label="Conversations" selectionMode="single">
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
      </Content>
    </View>
  );
}
