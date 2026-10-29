"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCreativeProjectQueries } from "@/lib/invalidate-creative-project-queries";

const SSE_EVENT_TYPES = [
  "message.created",
  "media.processing",
  "media.completed",
  "approval.created",
  "approval.required",
  "agent.approval.required",
  "agent.run.started",
  "agent.run.updated",
  "agent.run.completed",
  "agent.tool.started",
  "agent.tool.completed",
  "agent.tool.failed",
  "production.graph.updated",
  "production.step.queued",
  "production.delivery.ready",
  "delivery.ready",
  "provider.job.created",
  "provider.job.status",
  "agent.runtime.rollout.changed",
] as const;

type ProjectEventPayload = {
  eventId?: string;
  type?: string;
  payload?: { conversationId?: string };
};

function invalidateForEvent(qc: ReturnType<typeof useQueryClient>, projectId: string, data: ProjectEventPayload) {
  const conversationId = data.payload?.conversationId;
  void invalidateCreativeProjectQueries(
    qc,
    projectId,
    conversationId ? { conversationId } : undefined,
  );
}

function handleEventPayload(
  qc: ReturnType<typeof useQueryClient>,
  projectId: string,
  raw: string,
  lastIdRef: MutableRefObject<string | undefined>,
) {
  try {
    const data = JSON.parse(raw) as ProjectEventPayload;
    if (data.eventId) lastIdRef.current = data.eventId;
    if (data.type === "media.completed" || data.type === "media.processing") {
      invalidateForEvent(qc, projectId, data);
    }
    if (
      data.type === "message.created" ||
      data.type === "approval.created" ||
      data.type === "approval.required" ||
      data.type === "agent.approval.required"
    ) {
      invalidateForEvent(qc, projectId, data);
    }
    if (
      data.type?.startsWith("agent.") ||
      data.type?.startsWith("production.") ||
      data.type === "delivery.ready"
    ) {
      invalidateForEvent(qc, projectId, data);
    }
    if (data.type === "agent.tool.completed" || data.type === "agent.tool.failed") {
      invalidateForEvent(qc, projectId, data);
    }
    if (data.type === "provider.job.created" || data.type === "provider.job.status") {
      invalidateForEvent(qc, projectId, data);
    }
  } catch {
    /* ignore malformed */
  }
}

export function useProjectEvents(projectId: string | undefined) {
  const qc = useQueryClient();
  const lastIdRef = useRef<string | undefined>(undefined);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const after = lastIdRef.current;
      const url = `/api/v1/projects/${projectId}/events/stream${
        after ? `?after=${encodeURIComponent(after)}` : ""
      }`;
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => {
        setConnected(true);
        void invalidateCreativeProjectQueries(qc, projectId);
      };

      const onNamed = (ev: Event) => {
        const msg = ev as MessageEvent<string>;
        if (msg.lastEventId) lastIdRef.current = msg.lastEventId;
        handleEventPayload(qc, projectId, msg.data, lastIdRef);
      };

      for (const type of SSE_EVENT_TYPES) {
        es.addEventListener(type, onNamed);
      }

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setConnected(false);
    };
  }, [projectId, qc]);

  return { connected, lastEventId: lastIdRef.current };
}
