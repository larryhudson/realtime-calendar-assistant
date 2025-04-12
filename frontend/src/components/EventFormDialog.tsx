import React from "react";
import {
  Button,
  Flex,
  Heading,
  View,
  TextField,
  TextArea,
  DatePicker,
} from "@adobe/react-spectrum";
import { parseDate } from "@internationalized/date";
import type { EventForm } from "../hooks/useEventForm";

type EventFormDialogProps = {
  eventForm: EventForm;
  eventDialogOpen: boolean;
  onChange: (field: keyof EventForm, value: string) => void;
  onSave: () => void;
  onClose: () => void;
  error?: string;
};

const EventFormDialog: React.FC<EventFormDialogProps> = ({
  eventForm,
  eventDialogOpen,
  onChange,
  onSave,
  onClose,
  error,
}) => {
  if (!eventDialogOpen) return null;

  return (
    <View
      borderWidth="thin"
      borderColor="dark"
      padding="size-200"
      marginTop="size-200"
      backgroundColor="gray-50"
      maxWidth="size-3600"
      width="100%"
    >
      <Heading level={2}>Prefilled Calendar Event</Heading>
      <Flex direction="column" gap="size-200">
        <TextField
          label="Title"
          value={eventForm.title}
          onChange={(v) => onChange("title", v)}
        />
        <TextArea
          label="Description"
          value={eventForm.description}
          onChange={(v) => onChange("description", v)}
        />
        <DatePicker
          label="Start Date"
          value={eventForm.startDate ? parseDate(eventForm.startDate) : null}
          onChange={(value) =>
            onChange("startDate", value ? value.toString() : "")
          }
        />
        <TextField
          label="Start Time (HH:mm)"
          value={eventForm.startTime}
          onChange={(v) => onChange("startTime", v)}
        />
        <DatePicker
          label="End Date"
          value={eventForm.endDate ? parseDate(eventForm.endDate) : null}
          onChange={(value) =>
            onChange("endDate", value ? value.toString() : "")
          }
        />
        <TextField
          label="End Time (HH:mm)"
          value={eventForm.endTime}
          onChange={(v) => onChange("endTime", v)}
        />
        {error && (
          <View>
            <p style={{ color: "red" }}>{error}</p>
          </View>
        )}
        <Flex direction="row" gap="size-200">
          <Button variant="primary" onPress={onSave}>
            Save Event
          </Button>
          <Button variant="secondary" onPress={onClose}>
            Close
          </Button>
        </Flex>
      </Flex>
    </View>
  );
};

export default EventFormDialog;
