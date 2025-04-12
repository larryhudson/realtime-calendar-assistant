import React from "react";
import { Heading, View, ListView, Item, Text, Divider, Content } from "@adobe/react-spectrum";

/**
 * ConversationReview
 * 
 * UI for reviewing conversations, audio recordings, transcriptions, and notes/comments.
 * This is the entry point for the evaluation tools frontend.
 */
export default function ConversationReview() {
  // TODO: Fetch conversations from backend and display them
  // TODO: Allow selection of a conversation to review details
  // TODO: Display audio recordings, transcriptions, and notes/comments
  // TODO: Provide UI to add/view notes/comments

  return (
    <View padding="size-200">
      <Heading level={2}>Conversation Review & Evaluation</Heading>
      <Divider marginY="size-200" />
      <Content>
        <Text>
          Select a conversation to review audio recordings, transcriptions, and add notes/comments for evaluation.
        </Text>
        {/* Placeholder for conversation list */}
        <ListView aria-label="Conversations" selectionMode="single">
          {/* TODO: Map conversations here */}
          <Item key="placeholder">No conversations loaded yet.</Item>
        </ListView>
      </Content>
    </View>
  );
}
