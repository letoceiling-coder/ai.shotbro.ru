"use client";

import { AssetLibraryView } from "./asset-library/asset-library-view";

export function ProjectAssetsSection({ projectId }: { projectId: string }) {
  return <AssetLibraryView projectId={projectId} />;
}
