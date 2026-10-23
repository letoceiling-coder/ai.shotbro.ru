export type GraphNodeRow = {
  id: string;
  dependencies: string[] | null;
  status: string;
};

/** Topological order: dependencies before dependents. */
export function orderGraphNodes<T extends GraphNodeRow>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const out: T[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (!node) return;
    for (const dep of node.dependencies ?? []) visit(dep);
    out.push(node);
  };

  for (const n of nodes) visit(n.id);
  return out;
}
