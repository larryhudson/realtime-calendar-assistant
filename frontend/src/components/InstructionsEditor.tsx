import React from "react";
import { TextArea } from "@adobe/react-spectrum";

interface InstructionsEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const InstructionsEditor: React.FC<InstructionsEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <div style={{ minWidth: 320, maxWidth: 480 }}>
    <TextArea
      label="Model Instructions"
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      width="100%"
      maxWidth="size-3600"
      minHeight="size-800"
      placeholder="Enter custom instructions for the model..."
      data-testid="instructions-editor"
    />
  </div>
);
