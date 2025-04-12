import { useState, useEffect, useCallback } from "react";

export type Event = {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
};

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | undefined>(undefined);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(undefined);
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("Failed to fetch events: " + res.statusText);
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setEventsError(
        err instanceof Error ? err.message : "Unknown error fetching events"
      );
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    eventsLoading,
    eventsError,
    refreshEvents: fetchEvents,
  };
}
