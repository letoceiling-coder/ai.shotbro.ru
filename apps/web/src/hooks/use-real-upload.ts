"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";

type InitSingle = {
  mode: "single";
  sessionId: string;
  assetId: string;
  uploadUrl: string;
};

type InitMultipart = {
  mode: "multipart";
  sessionId: string;
  assetId: string;
  partSize: number;
  parts: Array<{ partNumber: number; uploadUrl: string }>;
};

export function useRealUpload(projectId: string | undefined) {
  const qc = useQueryClient();
  const [progressPct, setProgressPct] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      setProgressPct(0);
      if (!projectId) throw new Error("No project");
      const init = (await api.uploads.init({
        projectId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      })) as InitSingle | InitMultipart;

      if (init.mode === "single") {
        const put = await fetch(init.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed ${put.status}`);
        setProgressPct(100);
        await api.uploads.complete(init.sessionId);
        return init.assetId;
      }

      const parts: Array<{ partNumber: number; etag: string }> = [];
      let uploadedBytes = 0;
      for (const part of init.parts) {
        const start = (part.partNumber - 1) * init.partSize;
        const end = Math.min(start + init.partSize, file.size);
        const chunk = file.slice(start, end);
        const put = await fetch(part.uploadUrl, {
          method: "PUT",
          body: chunk,
        });
        if (!put.ok) throw new Error(`Part ${part.partNumber} failed`);
        const etag = put.headers.get("ETag") ?? put.headers.get("etag");
        if (!etag) throw new Error("Missing ETag from storage");
        parts.push({ partNumber: part.partNumber, etag: etag.replace(/"/g, "") });
        uploadedBytes += chunk.size;
        setProgressPct(Math.min(99, Math.round((uploadedBytes / file.size) * 100)));
      }
      await api.uploads.complete(init.sessionId, { parts });
      setProgressPct(100);
      return init.assetId;
    },
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: ["assets", projectId] });
    },
    onSettled: () => {
      setTimeout(() => setProgressPct(null), 1500);
    },
  });

  return { ...mutation, progressPct };
}
