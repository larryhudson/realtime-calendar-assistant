import { useEffect, useState } from "react";

export interface ConversationTranscription {
  id: number;
  audio_id: number;
  text: string;
  created_at: string;
  // Add other fields as needed
}

export function useConversationTranscriptions(conversationId: number | null) {
  const [transcriptions, setTranscriptions] = useState<ConversationTranscription[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId == null) {
      setTranscriptions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/conversations/${conversationId}/transcriptions`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch transcriptions");
        const data = await res.json();
        setTranscriptions(data);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setTranscriptions([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  return { transcriptions, loading, error };
}
