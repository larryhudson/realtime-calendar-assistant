import { useEffect, useState } from "react";

export interface ConversationAudio {
  id: number;
  conversation_id: number;
  file_path: string;
  url: string;
  created_at: string;
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
        // Map backend response to include url property
        setAudio(
          data.map((rec: any) => ({
            ...rec,
            url: `/uploads/${rec.file_path}`,
          }))
        );
      })
      .catch((err) => {
        setError(err.message || "Unknown error");
        setAudio([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  return { audio, loading, error };
}
