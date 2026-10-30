"use client";

import {
  createInitialDemoProjects,
  getAdMessages,
  type AdDemoStage,
  type ChatMessage,
  type GenerationStatus,
  type Project,
  type QualityStrategy,
} from "@shotbro/contracts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type StudioPanel = Project["activePanel"];

export type CreativeSection =
  | "chat"
  | "brief"
  | "script"
  | "storyboard"
  | "characters"
  | "references"
  | "prompts"
  | "models"
  | "production"
  | "timeline"
  | "assets"
  | "voices"
  | "avatars";

type AdStageMap = Record<string, AdDemoStage>;

interface StudioState {
  projects: Project[];
  activeProjectId: string;
  /** REAL mode — server project UUID */
  activeRealProjectId: string | null;
  setActiveRealProject: (id: string | null) => void;
  creativeSection: CreativeSection;
  setCreativeSection: (section: CreativeSection) => void;
  creativePromptSceneId: string | null;
  setCreativePromptSceneId: (id: string | null) => void;
  /** Asset Library → Timeline: pre-fill clip assignment */
  pendingTimelineAssetId: string | null;
  setPendingTimelineAssetId: (id: string | null) => void;
  /** Phase 5K deep links from chat tool cards */
  agentFocus: { sceneId?: string; assetId?: string; clipId?: string } | null;
  setAgentFocus: (focus: { sceneId?: string; assetId?: string; clipId?: string } | null) => void;
  /** Phase 5L-5: auto-open Creative section after agent tool success */
  creativeAutoNavigate: boolean;
  setCreativeAutoNavigate: (v: boolean) => void;
  sidebarCollapsed: boolean;
  qualityStrategy: QualityStrategy;
  adStages: AdStageMap;
  simulatorStatus: GenerationStatus;
  setSidebarCollapsed: (v: boolean) => void;
  setQualityStrategy: (s: QualityStrategy) => void;
  setActiveProject: (id: string) => void;
  createProject: (title?: string) => void;
  renameProject: (id: string, title: string) => void;
  duplicateProject: (id: string) => void;
  archiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
  setActivePanel: (panel: StudioPanel) => void;
  appendUserMessage: (text: string, files?: File[]) => void;
  handleApproval: (projectId: string, approvalId: string, actionId: string) => void;
  setSimulatorStatus: (status: GenerationStatus) => void;
  resetDemo: () => void;
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getActiveProject(state: StudioState): Project | undefined {
  return state.projects.find((p) => p.id === state.activeProjectId);
}

function updateProject(
  projects: Project[],
  id: string,
  patch: Partial<Project> | ((p: Project) => Project),
): Project[] {
  return projects.map((p) => {
    if (p.id !== id) return p;
    return typeof patch === "function" ? patch(p) : { ...p, ...patch };
  });
}

function applyAdStage(stage: AdDemoStage): { messages: ChatMessage[]; status: GenerationStatus } {
  const messages = getAdMessages(stage);
  const status: GenerationStatus =
    stage === "completed" ? "COMPLETED" : stage === "script_approved" ? "AWAITING_APPROVAL" : "AWAITING_APPROVAL";
  return { messages, status };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      projects: createInitialDemoProjects(),
      activeProjectId: "demo-ad",
      activeRealProjectId: null,
      setActiveRealProject: (id) => set({ activeRealProjectId: id }),
      creativeSection: "chat",
      setCreativeSection: (creativeSection) => set({ creativeSection }),
      creativePromptSceneId: null,
      setCreativePromptSceneId: (creativePromptSceneId) => set({ creativePromptSceneId }),
      pendingTimelineAssetId: null,
      setPendingTimelineAssetId: (pendingTimelineAssetId) => set({ pendingTimelineAssetId }),
      agentFocus: null,
      setAgentFocus: (agentFocus) => set({ agentFocus }),
      creativeAutoNavigate: true,
      setCreativeAutoNavigate: (creativeAutoNavigate) => set({ creativeAutoNavigate }),
      sidebarCollapsed: false,
      qualityStrategy: "balance",
      adStages: { "demo-ad": "initial" },
      simulatorStatus: "RUNNING",

      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setQualityStrategy: (s) => set({ qualityStrategy: s }),

      setActiveProject: (id) => set({ activeProjectId: id }),

      createProject: (title = "Новый проект") => {
        const id = newId("project");
        const project: Project = {
          id,
          title,
          demo: true,
          demoScenarioId: "photo",
          archived: false,
          updatedAt: new Date().toISOString(),
          messages: [],
          workflowStatus: "DRAFT",
          activePanel: "none",
        };
        set((s) => ({
          projects: [project, ...s.projects],
          activeProjectId: id,
        }));
      },

      renameProject: (id, title) =>
        set((s) => ({
          projects: updateProject(s.projects, id, {
            title,
            updatedAt: new Date().toISOString(),
          }),
        })),

      duplicateProject: (id) => {
        const source = get().projects.find((p) => p.id === id);
        if (!source) return;
        const copy: Project = {
          ...structuredClone(source),
          id: newId("project"),
          title: `${source.title} (копия)`,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          projects: [copy, ...s.projects],
          activeProjectId: copy.id,
        }));
      },

      archiveProject: (id) =>
        set((s) => ({
          projects: updateProject(s.projects, id, { archived: true }),
        })),

      deleteProject: (id) =>
        set((s) => {
          const remaining = s.projects.filter((p) => p.id !== id);
          const activeProjectId =
            s.activeProjectId === id ? (remaining[0]?.id ?? "") : s.activeProjectId;
          return { projects: remaining, activeProjectId };
        }),

      setActivePanel: (panel) =>
        set((s) => ({
          projects: updateProject(s.projects, s.activeProjectId, { activePanel: panel }),
        })),

      appendUserMessage: (text, files) => {
        const { activeProjectId } = get();
        const attachments = files?.map((file) => {
          const isImage = file.type.startsWith("image/");
          return {
            id: newId("att"),
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            url: isImage ? URL.createObjectURL(file) : "#",
            kind: isImage
              ? ("image" as const)
              : file.type.startsWith("video/")
                ? ("video" as const)
                : file.type.startsWith("audio/")
                  ? ("audio" as const)
                  : ("document" as const),
            demo: true as const,
          };
        });
        const msg: ChatMessage = {
          id: newId("msg"),
          role: "user",
          createdAt: new Date().toISOString(),
          demo: true,
          blocks: [{ type: "text", markdown: text }],
          attachments,
        };
        set((s) => ({
          projects: updateProject(s.projects, activeProjectId, (p) => ({
            ...p,
            updatedAt: new Date().toISOString(),
            messages: [...p.messages, msg],
          })),
        }));
      },

      handleApproval: (projectId, approvalId, actionId) => {
        set((s) => {
          let projects = s.projects;

          if (projectId === "demo-ad" && approvalId === "ad-script-approval" && actionId === "approve") {
            const stage: AdDemoStage = "script_approved";
            const { messages, status } = applyAdStage(stage);
            projects = updateProject(projects, projectId, {
              messages,
              workflowStatus: status,
              updatedAt: new Date().toISOString(),
            });
            return {
              projects,
              adStages: { ...s.adStages, [projectId]: stage },
            };
          }

          if (projectId === "demo-ad" && approvalId === "ad-frame-approval" && actionId === "approve") {
            const stage: AdDemoStage = "completed";
            const { messages, status } = applyAdStage(stage);
            projects = updateProject(projects, projectId, {
              messages,
              workflowStatus: status,
              activePanel: "result",
              updatedAt: new Date().toISOString(),
            });
            return {
              projects,
              adStages: { ...s.adStages, [projectId]: stage },
            };
          }

          if (actionId === "compare") {
            projects = updateProject(projects, projectId, { activePanel: "models" });
            return { projects };
          }

          if (actionId === "edit") {
            projects = updateProject(projects, projectId, {
              workflowStatus: "NEEDS_REVISION",
              activePanel: "script",
            });
            return { projects };
          }

          projects = updateProject(projects, projectId, (p) => ({
            ...p,
            messages: p.messages.map((m) => ({
              ...m,
              blocks: m.blocks.map((b) =>
                b.type === "approval" && b.approvalId === approvalId
                  ? {
                      ...b,
                      status:
                        actionId === "approve"
                          ? ("approved" as const)
                          : actionId === "reject"
                            ? ("rejected" as const)
                            : b.status,
                    }
                  : b,
              ),
            })),
          }));

          return { projects };
        });
      },

      setSimulatorStatus: (status) => set({ simulatorStatus: status }),

      resetDemo: () =>
        set({
          projects: createInitialDemoProjects(),
          activeProjectId: "demo-ad",
          adStages: { "demo-ad": "initial" },
          simulatorStatus: "RUNNING",
        }),
    }),
    {
      name: "shotbro-studio-demo-v1",
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        activeRealProjectId: s.activeRealProjectId,
        creativeSection: s.creativeSection,
        sidebarCollapsed: s.sidebarCollapsed,
        qualityStrategy: s.qualityStrategy,
        adStages: s.adStages,
        simulatorStatus: s.simulatorStatus,
        creativeAutoNavigate: s.creativeAutoNavigate,
      }),
    },
  ),
);

export function useActiveProject(): Project | undefined {
  return useStudioStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
}
