import type { KnowledgeState } from './model';
type Nodes = KnowledgeState['nodes'];

export function nodePath(nodes: Nodes, id: string): Nodes {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const path: Nodes = [];
  const visited = new Set<string>();
  let node = byId.get(id);
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    path.unshift(node);
    node = node.parent ? byId.get(node.parent) : undefined;
  }
  return path;
}

export function nodeLabel(nodes: Nodes, id: string) {
  return nodePath(nodes, id).map(node => node.name).join(' / ');
}

export function reorderSibling(nodes: Nodes, id: string, direction: -1 | 1): Nodes {
  const index = nodes.findIndex(node => node.id === id);
  if (index < 0) return nodes;
  const siblings = nodes.filter(node => node.parent === nodes[index].parent);
  const neighbor = siblings[siblings.findIndex(node => node.id === id) + direction];
  if (!neighbor) return nodes;
  const target = nodes.findIndex(node => node.id === neighbor.id);
  const result = [...nodes];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
