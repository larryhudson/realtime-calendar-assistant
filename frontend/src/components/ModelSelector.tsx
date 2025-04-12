import React from "react";
import { Picker, Item } from "@adobe/react-spectrum";

export type OpenAIModel =
  | "gpt-4o-realtime-preview-2024-12-17"
  | "gpt-4o-mini-realtime-preview-2024-12-17";

const MODEL_OPTIONS: { value: OpenAIModel; label: string }[] = [
  {
    value: "gpt-4o-realtime-preview-2024-12-17",
    label: "GPT-4o Realtime Preview",
  },
  {
    value: "gpt-4o-mini-realtime-preview-2024-12-17",
    label: "GPT-4o Mini Realtime Preview",
  },
];

interface ModelSelectorProps {
  value: OpenAIModel;
  onChange: (model: OpenAIModel) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <div style={{ minWidth: 260 }}>
    <Picker
      id="model-picker"
      label="OpenAI Model"
      selectedKey={value}
      onSelectionChange={key => onChange(key as OpenAIModel)}
      isDisabled={disabled}
      width="100%"
      data-testid="model-selector"
      marginTop="size-50"
    >
      {MODEL_OPTIONS.map(opt => (
        <Item key={opt.value}>{opt.label}</Item>
      ))}
    </Picker>
  </div>
);
