"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  return useMutation({
    mutationFn: async (file: File) => {
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
        await api.uploads.complete(init.sessionId);
        return init.assetId;
      }

      const parts: Array<{ partNumber: number; etag: string }> = [];
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
      }
      await api.uploads.complete(init.sessionId, { parts });
      return init.assetId;
    },
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: ["assets", projectId] });
    },
  });
}
