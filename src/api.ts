// src/api.ts

import type {
  Stats,
  Relationship,
  Actor,
  TagCluster,
  GraphData,
  GraphNode,
  GraphLink,
  Document,
  TimeScope,
  Manifest,
  ManifestTitle,
} from './types';

// ==============================
// Cache Management (MODIFIED - now caches by title + timeScope)
// ==============================
let cachedGraphs: Map<string, GraphData> = new Map();
let cachedManifest: Manifest | null = null;

// Helper to create cache key
const cacheKey = (title: string, timeScope: TimeScope) => `${title}::${timeScope}`;

// ==============================
// Raw Graph Types
// ==============================
type RawGraph = { nodes: any[]; links: any[] };

// Helper for scoped node lookup
const scopedKey = (time: TimeScope, id: string) => `${time}::${id}`;

// ==============================
// Manifest Loading
// ==============================
export async function loadManifest(): Promise<Manifest> {
  if (cachedManifest) return cachedManifest;
  
  cachedManifest = await fetchJson<Manifest>('manifest.json');
  return cachedManifest;
}

// ==============================
// Core Fetch Helper
// ==============================
async function fetchJson<T>(relPath: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${relPath}`);
  if (!res.ok) throw new Error(`Failed to fetch: ${relPath} (${res.status})`);
  return (await res.json()) as T;
}

// ==============================
// Load Raw Graph
// ==============================
async function loadRawGraph(title: string, timeScope: TimeScope): Promise<RawGraph> {
  const filename = `title-${title}-time-${timeScope}.json`;
  
  try {
    return await fetchJson<RawGraph>(filename);
  } catch (err) {
    throw new Error(`Failed to load graph for Title ${title}, Time ${timeScope}: ${err}`);
  }
}

// ==============================
// Cache Helper (MODIFIED - now async and loads on-demand)
// ==============================
function ensureGraphLoadedOrThrow() {
  if (cachedGraphs.size === 0) {
    throw new Error('No graph loaded yet. Call loadGraph(title, timeScope) first.');
  }
}

async function getGraphOrThrow(title: string, timeScope: TimeScope): Promise<GraphData> {
  const key = cacheKey(title, timeScope);
  let graph = cachedGraphs.get(key);
  
  // If not cached, load it now
  if (!graph) {
    console.log(`Graph not in cache for Title ${title}, Time ${timeScope}. Loading now...`);
    graph = await loadGraph(title, timeScope);
  }
  
  if (!graph) {
    throw new Error(`Failed to load graph for Title ${title}, Time ${timeScope}.`);
  }
  
  return graph;
}

// ==============================
// Main Graph Loader
// ==============================
export async function loadGraph(title: string, timeScope: TimeScope): Promise<GraphData> {
  const key = cacheKey(title, timeScope);
  
  // Return from cache if already loaded
  if (cachedGraphs.has(key)) {
    return cachedGraphs.get(key)!;
  }

  const raw = await loadRawGraph(title, timeScope);

  // Calculate degree for node sizing
  const degreeMap = new Map<string, number>();
  raw.links.forEach((link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
    degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
  });

  const nodes: GraphNode[] = raw.nodes.map((n) => {
    const degree = degreeMap.get(n.id) || 0;

    let baseColor: string;
    if (n.node_type === 'section' || n.node_type === 'index') {
      baseColor = '#41378F';
    } else if (n.node_type === 'entity' || n.node_type === 'concept') {
      baseColor = '#F0A734';
    } else {
      baseColor = '#AFBBE8';
    }

    return {
      id: n.id,
      name: n.name,
      node_type: n.node_type,
      time: n.time,
      usc_title: n.title,
      source_title: n.title,
      val: degree,
      totalVal: degree,
      display_label: n.display_label,
      properties: n.properties,
      
      // Hierarchy fields
      title: n.title,
      subtitle: n.subtitle,
      part: n.part,
      chapter: n.chapter,
      subchapter: n.subchapter,
      section: n.section,
      subsection: n.subsection,
      
      // Legacy fields
      full_name: n.full_name,
      text: n.text ?? n.properties?.text,
      term_type: n.term_type,
      section_text: n.text ?? n.properties?.text,
      
      // Visual properties
      color: baseColor,
      baseColor,
    };
  });

  const links: GraphLink[] = raw.links.map((l) => {
    const edgeType = l.edge_type ?? 'reference';
    return {
      source: l.source,
      target: l.target,
      action: l.action || edgeType,
      edge_type: edgeType,
      time: l.time,
      usc_title: l.title,
      source_title: l.title,
      weight: l.weight ?? 1,
      definition: l.definition,
      location: l.location,
      timestamp: l.timestamp,
    };
  });

  const graphData = { nodes, links };
  cachedGraphs.set(key, graphData);
  
  return graphData;
}

// ==============================
// Stats
// ==============================
export async function fetchStats(title: string, timeScope: TimeScope): Promise<Stats> {
  const graph = await getGraphOrThrow(title, timeScope);
  
  const edgeTypeCounts: Record<string, number> = {};
  graph.links.forEach((link) => {
    edgeTypeCounts[link.edge_type] = (edgeTypeCounts[link.edge_type] || 0) + 1;
  });

  return {
    totalDocuments: { count: graph.nodes.length },
    totalTriples: { count: graph.links.length },
    totalActors: { count: graph.nodes.length },
    categories: Object.entries(edgeTypeCounts).map(([category, count]) => ({
      category,
      count,
    })),
  };
}

// ==============================
// Tag Clusters
// ==============================
export async function fetchTagClusters(): Promise<TagCluster[]> {
  return [];
}

// ==============================
// Relationships
// ==============================
export async function fetchRelationships(
  limit: number,
  clusterIds: number[],
  categories: string[],
  yearRange: [number, number],
  includeUndated: boolean,
  keywords: string,
  maxHops: number | null,
  title: string,
  timeScope: TimeScope
): Promise<{ relationships: Relationship[]; totalBeforeLimit: number }> {
  const graph = await getGraphOrThrow(title, timeScope);

  let filteredLinks = graph.links.filter((l) => l.time === timeScope);

  if (categories.length > 0) {
    filteredLinks = filteredLinks.filter((link) => categories.includes(link.edge_type));
  }

  const nodeMap = new Map(
    graph.nodes.map((n) => [scopedKey(n.time as TimeScope, String(n.id)), n] as const)
  );

  const relationships: Relationship[] = filteredLinks.slice(0, limit).map((link, idx) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const sourceNode = nodeMap.get(scopedKey(timeScope, String(sourceId)));
    const targetNode = nodeMap.get(scopedKey(timeScope, String(targetId)));

    return {
      id: idx,
      doc_id: String(sourceId),
      timestamp: (link as any).timestamp || null,
      actor: sourceNode?.name || String(sourceId),
      action: link.action,
      target: targetNode?.name || String(targetId),
      location: (link as any).location || null,
      tags: [],
      actor_type: sourceNode?.node_type,
      target_type: targetNode?.node_type,
      actor_id: String(sourceId),
      target_id: String(targetId),
      definition: link.definition,
      actor_display_label: sourceNode?.display_label,
      target_display_label: targetNode?.display_label,
    };
  });

  return {
    relationships,
    totalBeforeLimit: filteredLinks.length,
  };
}

// ==============================
// Actor Relationships
// ==============================
export async function fetchActorRelationships(
  actorId: string,
  clusterIds: number[],
  categories: string[],
  yearRange: [number, number],
  includeUndated: boolean,
  keywords: string,
  maxHops: number | null,
  title: string,
  timeScope: TimeScope,
  enabledNodeTypes?: string[]  // ← ADD this parameter
): Promise<{ relationships: Relationship[]; totalBeforeFilter: number }> {
  const graph = await getGraphOrThrow(title, timeScope);

  const actorNode = graph.nodes.find((n) => n.id === actorId && n.time === timeScope);
  if (!actorNode) return { relationships: [], totalBeforeFilter: 0 };

  const nodeMap = new Map(
    graph.nodes.map((n) => [scopedKey(n.time as TimeScope, String(n.id)), n] as const)
  );

  // Get all related links
  let relatedLinks = graph.links.filter((link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    return link.time === timeScope && (sourceId === actorNode.id || targetId === actorNode.id);
  });

  const totalBeforeFilter = relatedLinks.length;

  // Apply category filters (edge types)
  if (categories.length > 0 && categories.length < 3) {
    relatedLinks = relatedLinks.filter((link) => categories.includes(link.edge_type));
  }

  // Apply node type filters
if (enabledNodeTypes && enabledNodeTypes.length > 0 && enabledNodeTypes.length < 3) {
  relatedLinks = relatedLinks.filter((link) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    const sourceNode = nodeMap.get(scopedKey(timeScope, String(sourceId)));
    const targetNode = nodeMap.get(scopedKey(timeScope, String(targetId)));
    
    const actorEnabled = sourceNode?.node_type && enabledNodeTypes.includes(sourceNode.node_type);
    const targetEnabled = targetNode?.node_type && enabledNodeTypes.includes(targetNode.node_type);
    
    // Include ONLY if BOTH actor AND target match enabled types
    return actorEnabled && targetEnabled;  // ← Changed from || to &&
  });
}

  // Convert to relationships
  const relationships: Relationship[] = relatedLinks.map((link, idx) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const sourceNode = nodeMap.get(scopedKey(timeScope, String(sourceId)));
    const targetNode = nodeMap.get(scopedKey(timeScope, String(targetId)));

    return {
      id: idx,
      doc_id: String(sourceId),
      timestamp: (link as any).timestamp || null,
      actor: sourceNode?.name || String(sourceId),
      action: link.action,
      target: targetNode?.name || String(targetId),
      location: (link as any).location || null,
      tags: [],
      actor_type: sourceNode?.node_type,
      target_type: targetNode?.node_type,
      actor_id: String(sourceId),
      target_id: String(targetId),
      edge_type: link.edge_type,
      definition: link.definition,
      actor_display_label: sourceNode?.display_label,
      target_display_label: targetNode?.display_label,
    };
  });

  return {
    relationships,
    totalBeforeFilter,
  };
}



// ==============================
// Node Relationships
// ==============================
export async function fetchNodeRelationships(
  nodeId: string,
  clusterIds: number[],
  categories: string[],
  yearRange: [number, number],
  includeUndated: boolean,
  keywords: string,
  maxHops: number | null,
  title: string,
  timeScope: TimeScope
): Promise<{ relationships: Relationship[]; totalBeforeFilter: number }> {
  return fetchActorRelationships(
    nodeId,
    clusterIds,
    categories,
    yearRange,
    includeUndated,
    keywords,
    maxHops,
    title,
    timeScope
  );
}

// ==============================
// Actor Counts
// ==============================
export async function fetchActorCounts(
  limit: number,
  actorIds?: string[],
  title?: string,
  timeScope?: TimeScope
): Promise<Record<string, number>> {
  ensureGraphLoadedOrThrow();

  // If specific title/time, use that graph, otherwise use first cached graph
  let graph: GraphData;
  if (title && timeScope) {
    graph = await getGraphOrThrow(title, timeScope);
  } else {
    graph = Array.from(cachedGraphs.values())[0];
  }

  const nodes = timeScope ? graph.nodes.filter((n) => n.time === timeScope) : graph.nodes;

  const counts: Record<string, number> = {};

  if (actorIds && actorIds.length > 0) {
    actorIds.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (node) counts[id] = node.val || 0;
    });
  } else {
    nodes.forEach((node) => {
      counts[node.id] = node.val || 0;
    });
  }

  return counts;
}

// ==============================
// Node Counts
// ==============================
export async function fetchNodeCounts(
  limit: number,
  nodeIds?: string[],
  title?: string,
  timeScope?: TimeScope
): Promise<Record<string, number>> {
  return fetchActorCounts(limit, nodeIds, title, timeScope);
}

// ==============================
// Search Actors
// ==============================
export async function searchActors(
  query: string, 
  title: string,
  timeScope: TimeScope
): Promise<Actor[]> {
  const graph = await getGraphOrThrow(title, timeScope);

  const lowerQuery = query.toLowerCase();
  
  const pool = graph.nodes.filter((n) => n.time === timeScope);

  const matches = pool
    .filter((node) => {
      const nameMatch = (node.name ?? '').toLowerCase().includes(lowerQuery);
      const labelMatch = (node.display_label ?? '').toLowerCase().includes(lowerQuery);
      const textMatch = (node.properties?.text ?? '').toLowerCase().includes(lowerQuery);
      return nameMatch || labelMatch || textMatch;
    })
    .map((node) => ({
      id: node.id,
      name: node.display_label || node.name,
      connection_count: node.val || 0,
      time: node.time,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 20);

  return matches;
}

// ==============================
// Fetch Document
// ==============================
export async function fetchDocument(
  docId: string, 
  title: string,
  timeScope: TimeScope
): Promise<Document> {
  const graph = await getGraphOrThrow(title, timeScope);
  const node = graph.nodes.find((n) => n.id === docId && n.time === timeScope);

  return {
    doc_id: docId,
    file_path: '',
    one_sentence_summary: `Title ${title} node ${docId}`,
    paragraph_summary: `Details for this node from Title ${title}, time scope ${timeScope}.`,
    category: `Title ${title}`,
    date_range_earliest: null,
    date_range_latest: null,
    full_name: node?.full_name,
    text: (node as any)?.properties?.text ?? node?.text,
    title: node?.title,
    part: node?.part,
    chapter: node?.chapter,
    subchapter: node?.subchapter,
    section: node?.section,
    subsection: node?.subsection,
    subtitle: node?.subtitle,
  };
}

// ==============================
// Fetch Document Text
// ==============================
export async function fetchDocumentText(
  docId: string,
  title: string,
  timeScope: TimeScope
): Promise<{ text: string }> {
  const graph = await getGraphOrThrow(title, timeScope);

  const node = graph.nodes.find((n) => n.id === docId && n.time === timeScope);

  const text =
    (node as any)?.properties?.text ||
    node?.text ||
    (node as any)?.section_text ||
    (node as any)?.properties?.full_name ||
    (node as any)?.full_name ||
    'No text available for this node.';

  return { text };
}

// ==============================
// Fetch Node Details
// ==============================
export async function fetchNodeDetails(
  nodeId: string, 
  title: string,
  timeScope: TimeScope
): Promise<any> {
  const graph = await getGraphOrThrow(title, timeScope);

  let node = graph.nodes.find((n) => n.id === nodeId && n.time === timeScope);
  if (!node) node = graph.nodes.find((n) => n.name === nodeId && n.time === timeScope);
  if (!node) return null;

  return { ...node, ...(node as any).properties };
}

// ==============================
// Helper to check if node exists in a time scope
// ==============================
export async function nodeExistsInTimeScope(
  nodeId: string,
  title: string,
  timeScope: TimeScope
): Promise<boolean> {
  try {
    const node = await fetchNodeDetails(nodeId, title, timeScope);
    return node !== null;
  } catch {
    return false;
  }
}

// ==============================
// Get all time scopes where a node exists
// ==============================
export async function getNodeTimeScopes(
  nodeId: string,
  title: string,
  availableTimeScopes: string[]
): Promise<string[]> {
  const existingScopes: string[] = [];
  
  for (const timeScope of availableTimeScopes) {
    try {
      await loadGraph(title, timeScope);
      if (await nodeExistsInTimeScope(nodeId, title, timeScope)) {
        existingScopes.push(timeScope);
      }
    } catch (err) {
      console.warn(`Failed to check node in ${timeScope}:`, err);
    }
  }
  
  return existingScopes;
}
