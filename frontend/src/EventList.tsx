import React from "react";
import { Flex, Heading, View, Text } from "@adobe/react-spectrum";

type Event = {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
};

type EventListProps = {
  events: Event[];
  loading: boolean;
  error?: string;
};

const EventList: React.FC<EventListProps> = ({ events, loading, error }) => {
  if (loading) {
    return (
      <View marginTop="size-200">
        <Text>Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View marginTop="size-200" UNSAFE_style={{ color: "red" }}>
        <Text>{error}</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View marginTop="size-200">
        <Text>No events found.</Text>
      </View>
    );
  }

  return (
    <View marginTop="size-200">
      <Heading level={2}>Your Saved Events</Heading>
      <Flex direction="column" gap="size-200">
        {events.map((event) => (
          <View
            key={event.id}
            borderWidth="thin"
            borderColor="dark"
            padding="size-200"
            backgroundColor="gray-50"
            maxWidth="size-3600"
            width="100%"
          >
            <Heading level={3}>{event.title}</Heading>
            <Text>
              <strong>Description:</strong> {event.description || "—"}
            </Text>
            <br />
            <Text>
              <strong>Start:</strong> {new Date(event.start_time).toLocaleString()}
            </Text>
            <br />
            <Text>
              <strong>End:</strong> {new Date(event.end_time).toLocaleString()}
            </Text>
          </View>
        ))}
      </Flex>
    </View>
  );
};

export default EventList;
