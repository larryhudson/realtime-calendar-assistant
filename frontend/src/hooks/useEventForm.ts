import { useState } from "react";

export type EventForm = {
  title: string;
  description: string;
  startDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endDate: string;   // yyyy-mm-dd
  endTime: string;   // HH:mm
};

const INITIAL_EVENT_FORM: EventForm = {
  title: "",
  description: "",
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
};

export function useEventForm(initialState: EventForm = INITIAL_EVENT_FORM) {
  const [eventForm, setEventForm] = useState<EventForm>(initialState);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const handleEventFormChange = (field: keyof EventForm, value: string) => {
    setEventForm((prev) => ({ ...prev, [field]: value }));
  };

  const openEventDialog = (prefill?: Partial<EventForm>) => {
    setEventForm((prev) => ({ ...prev, ...prefill }));
    setEventDialogOpen(true);
  };

  const closeEventDialog = () => {
    setEventDialogOpen(false);
  };

  const resetEventForm = () => {
    setEventForm(INITIAL_EVENT_FORM);
  };

  return {
    eventForm,
    setEventForm,
    eventDialogOpen,
    openEventDialog,
    closeEventDialog,
    handleEventFormChange,
    resetEventForm,
  };
}
