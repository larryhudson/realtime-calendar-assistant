import { useState } from "react";

export interface AddNoteInput {
  content: string;
  timestamp: string;
  author?: string;
}

export function useAddConversationNote(conversationId: number | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function addNote(input: AddNoteInput) {
    if (conversationId == null) {
      setError("No conversation selected");
      setSuccess(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add note");
      }
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unknown error");
      }
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  return { addNote, loading, error, success };
}
