import { useEffect, useState } from "react";

export interface ConversationAudio {
  id: number;
  filename: string;
  url: string;
  created_at: string;
  // Add other fields as needed
}

export function useConversationAudio(conversationId: number | null) {
  const [audio, setAudio] = useState<ConversationAudio[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId == null) {
      setAudio([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/conversations/${conversationId}/audio`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch audio recordings");
        const data = await res.json();
        setAudio(data);
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setAudio([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  return { audio, loading, error };
}
