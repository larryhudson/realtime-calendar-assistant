import React, { useEffect, useState } from "react";
import { Picker, Item, TextArea, Flex, Heading, Content, View } from "@adobe/react-spectrum";

interface Prompt {
  id: number;
  name: string;
  description?: string;
  latest_text?: string;
  latest_version_id?: number;
  latest_version_number?: number;
  latest_version_created_at?: string;
}

interface PromptSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onPromptVersionIdChange?: (id: number | null) => void;
}

export const PromptSelector: React.FC<PromptSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  onPromptVersionIdChange,
}) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        setPrompts(data);
        // If no prompt selected, select the first one
        if (data.length > 0 && selectedPromptId === null) {
          setSelectedPromptId(data[0].id);
          if (data[0].latest_text) {
            onChange(data[0].latest_text);
          }
        }
      });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (selectedPromptId !== null) {
      const prompt = prompts.find((p) => p.id === selectedPromptId);
      if (prompt && prompt.latest_text !== value) {
        onChange(prompt.latest_text || "");
      }
      if (onPromptVersionIdChange) {
        onPromptVersionIdChange(prompt?.latest_version_id ?? null);
      }
    } else {
      if (onPromptVersionIdChange) {
        onPromptVersionIdChange(null);
      }
    }
    // eslint-disable-next-line
  }, [selectedPromptId]);

  return (
    <View minWidth="320px" maxWidth="480px">
      <Picker
        label="Select Prompt"
        isDisabled={disabled}
        selectedKey={selectedPromptId?.toString() ?? undefined}
        onSelectionChange={(key) => {
          const id = typeof key === "string" ? parseInt(key, 10) : Number(key);
          console.log('Selected prompt ID:', id);
          setSelectedPromptId(id);
        }}
        width="100%"
        data-testid="prompt-selector"
      >
        {prompts.map((prompt) => (
          <Item textValue={prompt.name} key={prompt.id}>
            {prompt.name}
          </Item>
        ))}
      </Picker>
      <TextArea
        label="Prompt Text"
        value={
          prompts.find((p) => p.id === selectedPromptId)?.latest_text || ""
        }
        isReadOnly
        width="100%"
        maxWidth="size-3600"
        minHeight="size-800"
        marginTop="size-200"
        data-testid="prompt-text"
      />
    </View>
  );
};
