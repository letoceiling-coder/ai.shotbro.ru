import { StudioShell } from "@/components/studio/studio-shell";

/** Workspace voice library inside the studio (uploads and price cards use the open project). */
export default function VoicesLibraryPage() {
  return <StudioShell initialSection="voices" />;
}
