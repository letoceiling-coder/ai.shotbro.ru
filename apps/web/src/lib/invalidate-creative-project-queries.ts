import type { QueryClient } from "@tanstack/react-query";

/** Single invalidation surface after agent/creative mutations (Phase 5L-4). */
export function invalidateCreativeProjectQueries(
  qc: QueryClient,
  projectId: string,
  opts?: { conversationId?: string },
) {
  const tasks: Array<Promise<unknown>> = [
    qc.invalidateQueries({ queryKey: ["storyboard", projectId] }),
    qc.invalidateQueries({ queryKey: ["canvas", projectId] }),
    qc.invalidateQueries({ queryKey: ["timeline", projectId] }),
    qc.invalidateQueries({ queryKey: ["assets", projectId] }),
    qc.invalidateQueries({ queryKey: ["project-assets", projectId] }),
    qc.invalidateQueries({ queryKey: ["asset-library", projectId] }),
    qc.invalidateQueries({ queryKey: ["references", projectId] }),
    qc.invalidateQueries({ queryKey: ["characters", projectId] }),
    qc.invalidateQueries({ queryKey: ["script", projectId] }),
    qc.invalidateQueries({ queryKey: ["brief", projectId] }),
    qc.invalidateQueries({ queryKey: ["agent-runs", projectId] }),
    qc.invalidateQueries({ queryKey: ["provider-jobs", projectId] }),
    qc.invalidateQueries({ queryKey: ["production-graph", projectId] }),
    qc.invalidateQueries({ queryKey: ["approvals", projectId] }),
    qc.invalidateQueries({ queryKey: ["project", projectId] }),
    qc.invalidateQueries({ queryKey: ["messages"] }),
  ];
  if (opts?.conversationId) {
    tasks.push(qc.invalidateQueries({ queryKey: ["messages", opts.conversationId] }));
  }
  return Promise.all(tasks);
}
