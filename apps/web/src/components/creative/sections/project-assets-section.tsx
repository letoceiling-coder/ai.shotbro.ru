"use client";

import { AssetLibraryView } from "./asset-library/asset-library-view";

export function ProjectAssetsSection({ projectId }: { projectId: string }) {
  return (
    <div data-testid="project-assets" className="flex min-h-0 flex-1 flex-col">
      <AssetLibraryView projectId={projectId} />
    </div>
  );
}
