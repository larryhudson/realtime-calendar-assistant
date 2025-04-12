import { useEffect, useState } from "react";

export interface Conversation {
  id: number;
  title?: string;
  created_at: string;
  // Add other fields as needed
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/conversations")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        if (!cancelled) setConversations(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { conversations, loading, error };
}
