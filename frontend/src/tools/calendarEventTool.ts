import { OpenAIToolSchema } from "../hooks/useOpenAISession";

// Type for calendar event function arguments
export type CalendarEventFunctionArgs = {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
};

// Type guard for CalendarEventFunctionArgs
export function isCalendarEventFunctionArgs(obj: unknown): obj is CalendarEventFunctionArgs {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.start_time === "string" &&
    typeof o.end_time === "string"
  );
}

/**
 * Convert CalendarEventFunctionArgs to the event form object expected by openEventDialog.
 */
export function getEventFormFromFunctionArgs(args: CalendarEventFunctionArgs) {
  return {
    title: args.title || "",
    description: args.description || "",
    startDate: args.start_time ? args.start_time.slice(0, 10) : "",
    startTime: args.start_time ? args.start_time.slice(11, 16) : "",
    endDate: args.end_time ? args.end_time.slice(0, 10) : "",
    endTime: args.end_time ? args.end_time.slice(11, 16) : "",
  };
}

// Calendar event tool schema
export const calendarEventTool: OpenAIToolSchema = {
  type: "function",
  name: "create_calendar_event",
  description: "Create a calendar event with structured data.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      description: { type: "string", description: "Event description" },
      start_time: { type: "string", description: "Event start time (ISO 8601)" },
      end_time: { type: "string", description: "Event end time (ISO 8601)" }
    },
    required: ["title", "start_time", "end_time"]
  }
};
