import { useState } from "react";

export function useUploadConversationAudio(conversationId: number | null) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function uploadAudio(audio: Blob, filename: string = "conversation.webm") {
    console.log("[useUploadConversationAudio] uploadAudio called", { conversationId, filename, audio });
    if (!conversationId) {
      console.log("[useUploadConversationAudio] No conversation selected, aborting upload.");
      setError("No conversation selected");
      setSuccess(false);
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      console.log("[useUploadConversationAudio] Starting upload...");
      const formData = new FormData();
      formData.append("file", audio, filename);
      const res = await fetch(`/api/conversations/${conversationId}/audio`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        console.log("[useUploadConversationAudio] Upload failed with status", res.status);
        throw new Error("Failed to upload audio");
      }
      setSuccess(true);
      console.log("[useUploadConversationAudio] Upload successful.");
    } catch (err) {
      setError((err as Error).message || "Unknown error");
      setSuccess(false);
      console.log("[useUploadConversationAudio] Upload error:", err);
    } finally {
      setUploading(false);
      console.log("[useUploadConversationAudio] Upload finished.");
    }
  }

  return { uploadAudio, uploading, error, success };
}
