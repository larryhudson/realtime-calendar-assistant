import { useEffect, useState } from "react";

export interface ConversationNote {
  id: number;
  author: string | null;
  content: string;
  timestamp: string;
}

export function useConversationNotes(conversationId: number | null) {
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId == null) {
      setNotes([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/conversations/${conversationId}/notes`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch notes");
        const data = await res.json();
        setNotes(data);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setNotes([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  return { notes, loading, error };
}
