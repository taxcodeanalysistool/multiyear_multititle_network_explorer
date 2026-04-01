// src/services/networkBuilder.ts

import type { GraphNode, GraphLink, NetworkBuilderState, FilteredGraph } from '../types';
import { parseSearchQuery } from '../utils/parseSearchQuery';

export class NetworkBuilder {
  private allNodes: GraphNode[];
  private allLinks: GraphLink[];
  private adjacencyMap: Map<string, Array<{ neighborId: string; edgeType: string }>>;

  constructor(nodes: GraphNode[], links: GraphLink[]) {
    this.allNodes = nodes;
    this.allLinks = links;

    this.adjacencyMap = new Map();

    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const edgeType = link.edge_type;

      if (!this.adjacencyMap.has(sourceId)) this.adjacencyMap.set(sourceId, []);
      if (!this.adjacencyMap.has(targetId)) this.adjacencyMap.set(targetId, []);

      this.adjacencyMap.get(sourceId)!.push({ neighborId: targetId, edgeType });
      this.adjacencyMap.get(targetId)!.push({ neighborId: sourceId, edgeType });
    });
  }

  searchNodes(
    searchTerms: string[],
    searchFields: string[],
    logic: 'AND' | 'OR' = 'OR',
    useRegex: boolean = false
  ): Set<string> {
    const matchedIds = new Set<string>();

    if (useRegex) {
      // ── Regex mode: unchanged — each term is a raw regex pattern ──────────
      const normalizedTerms = searchTerms.map(t => t.trim());
      const regexPatterns: (RegExp | null)[] = normalizedTerms.map(term => {
        try { return new RegExp(term, 'i'); } catch { return null; }
      });

      const termMatches = (termIdx: number, searchableValues: string[]): boolean => {
        const re = regexPatterns[termIdx];
        return re ? searchableValues.some(v => re.test(v)) : false;
      };

      this.allNodes.forEach(node => {
        const searchableValues = this.getSearchableValues(node, searchFields, true);
        if (logic === 'OR') {
          if (normalizedTerms.some((_, idx) => termMatches(idx, searchableValues)))
            matchedIds.add(node.id);
        } else {
          if (normalizedTerms.every((_, idx) => termMatches(idx, searchableValues)))
            matchedIds.add(node.id);
        }
      });

      return matchedIds;
    }

    // ── Plain text mode: parse quoted phrases vs. individual keywords ────────
    //
    // searchTerms here is the raw comma-separated string joined back, OR
    // individual terms already split. We re-parse from the original input
    // to correctly extract "quoted phrases" vs keywords.
    //
    // Since searchTerms arrives as an array (already split in App.tsx),
    // we reconstruct the original string to run parseSearchQuery on it.
    // Quoted phrases arrive with their quotes intact (e.g. ['"consumer price index"', 'tax']).
    const rawInput = searchTerms.join(', ');
    const { phrases, keywords } = parseSearchQuery(rawInput);

    // Phrases: exact substring match (case-insensitive)
    const lowerPhrases = phrases.map(p => p.toLowerCase());
    // Keywords: individual substring match (case-insensitive)
    const lowerKeywords = keywords.map(k => k.toLowerCase());

    // Combined list of matchers — each is { type, value }
    type Matcher = { type: 'phrase' | 'keyword'; value: string };
    const matchers: Matcher[] = [
      ...lowerPhrases.map(p  => ({ type: 'phrase'  as const, value: p })),
      ...lowerKeywords.map(k => ({ type: 'keyword' as const, value: k })),
    ];

    if (matchers.length === 0) return matchedIds;

    const matcherMatches = (matcher: Matcher, searchableValues: string[]): boolean => {
      // Both phrase and keyword use includes() — the difference is that a phrase
      // is a multi-word string so includes() naturally enforces contiguous matching.
      return searchableValues.some(v => v.includes(matcher.value));
    };

    this.allNodes.forEach(node => {
      const searchableValues = this.getSearchableValues(node, searchFields, false);

      const matched = logic === 'OR'
        ? matchers.some(m  => matcherMatches(m, searchableValues))
        : matchers.every(m => matcherMatches(m, searchableValues));

      if (matched) matchedIds.add(node.id);
    });

    return matchedIds;
  }

  // ── Extracted helper: build the list of searchable string values for a node ─
  private getSearchableValues(
    node: GraphNode,
    searchFields: string[],
    preserveCase: boolean
  ): string[] {
    const values: string[] = [];

    const add = (v: any) => {
      if (v !== null && v !== undefined) {
        values.push(preserveCase ? String(v) : String(v).toLowerCase());
      }
    };

    searchFields.forEach(field => {
      switch (field) {
        case 'text':
          add(node.properties?.text || node.text || node.section_text || node.index_heading);
          break;
        case 'full_name':
          add(node.properties?.full_name || node.full_name);
          break;
        case 'display_label':
          add(node.display_label);
          break;
        case 'definition':
          add(node.properties?.definition);
          break;
        case 'entity':
          if (node.node_type === 'entity') add(node.name);
          break;
        case 'concept':
          if (node.node_type === 'concept') add(node.name);
          break;
        case 'properties':
          if (node.properties && typeof node.properties === 'object') {
            Object.values(node.properties).forEach(propValue => {
              if (typeof propValue === 'string') add(propValue);
            });
          }
          break;
        default:
          add((node as any)[field]);
      }
    });

    return values;
  }

  expandFromSeeds(
    seedIds: Set<string>,
    depth: number,
    maxNeighborsPerNode: number,
    allowedEdgeTypes: string[]
  ): Set<string> {
    const expanded = new Set<string>(seedIds);
    let currentLayer = new Set<string>(seedIds);

    for (let i = 0; i < depth; i++) {
      const nextLayer = new Set<string>();

      currentLayer.forEach(nodeId => {
        const neighbors = this.adjacencyMap.get(nodeId) || [];

        const filteredNeighbors = allowedEdgeTypes.length > 0
          ? neighbors.filter(n => allowedEdgeTypes.includes(n.edgeType))
          : neighbors;

        const limitedNeighbors = maxNeighborsPerNode > 0
          ? filteredNeighbors.slice(0, maxNeighborsPerNode)
          : filteredNeighbors;

        limitedNeighbors.forEach(({ neighborId }) => {
          if (!expanded.has(neighborId)) {
            nextLayer.add(neighborId);
            expanded.add(neighborId);
          }
        });
      });

      currentLayer = nextLayer;
      if (currentLayer.size === 0) break;
    }

    return expanded;
  }

  buildNetwork(
    state: NetworkBuilderState,
    searchLogic: 'AND' | 'OR' = 'OR',
    nodeRankingMode: 'global' | 'subgraph' = 'global',
    useRegex: boolean = false
  ): FilteredGraph {
    let candidateNodeIds = new Set<string>();
    let seedNodeIds = new Set<string>();

    // Step 1: Keyword search
    if (state.searchTerms.length > 0 && state.searchFields.length > 0) {
      seedNodeIds = this.searchNodes(state.searchTerms, state.searchFields, searchLogic, useRegex);

      if (seedNodeIds.size === 0) {
        return { nodes: [], links: [], truncated: false, matchedCount: 0 };
      }

      if (state.expansionDepth > 0) {
        candidateNodeIds = this.expandFromSeeds(
          seedNodeIds,
          state.expansionDepth,
          state.maxNodesPerExpansion,
          state.allowedEdgeTypes
        );

        if (state.allowedNodeTypes.length > 0) {
          candidateNodeIds = new Set(
            [...candidateNodeIds].filter(id => {
              const node = this.allNodes.find(n => n.id === id);
              if (!node) return false;
              if (seedNodeIds.has(id)) return true;
              return state.allowedNodeTypes.includes(node.node_type);
            })
          );
        }
      } else {
        candidateNodeIds = new Set(seedNodeIds);
      }
    } else {
      candidateNodeIds = new Set(this.allNodes.map(n => n.id));
    }

    // Step 2: Filter seed nodes by type
    if (state.searchTerms.length > 0 && state.searchFields.length > 0) {
      const seedsAfterFilter = new Set(
        [...seedNodeIds].filter(id => {
          const node = this.allNodes.find(n => n.id === id);
          if (!node) return false;
          return state.allowedNodeTypes.length > 0 &&
                 state.allowedNodeTypes.includes(node.node_type);
        })
      );

      if (seedsAfterFilter.size === 0) {
        return { nodes: [], links: [], truncated: false, matchedCount: 0 };
      }

      candidateNodeIds = new Set(
        [...candidateNodeIds].filter(id =>
          seedsAfterFilter.has(id) || !seedNodeIds.has(id)
        )
      );

      seedNodeIds = seedsAfterFilter;
    }

    // Step 3: Build candidate node map
    const candidateNodeMap = new Map<string, GraphNode>();
    this.allNodes.forEach(n => {
      if (candidateNodeIds.has(n.id)) candidateNodeMap.set(n.id, n);
    });

    const candidateNodes = Array.from(candidateNodeMap.values());

    // Step 4: Filter links by edge type
    const candidateLinks = this.allLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      const edgeTypeMatch = state.allowedEdgeTypes.length > 0 &&
                            state.allowedEdgeTypes.includes(link.edge_type);

      return edgeTypeMatch && candidateNodeMap.has(sourceId) && candidateNodeMap.has(targetId);
    });

    // Step 5: Remove isolated nodes and filter by type
    const nodesWithEdges = new Set<string>();
    candidateLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      nodesWithEdges.add(sourceId);
      nodesWithEdges.add(targetId);
    });

    const connectedNodeIds = new Set(
      candidateNodes
        .filter(n => {
          const hasEdges = nodesWithEdges.has(n.id);
          const typeMatch = state.allowedNodeTypes.length === 0 ||
                            state.allowedNodeTypes.includes(n.node_type);
          return hasEdges && typeMatch;
        })
        .map(n => n.id)
    );

    // Step 6: Apply node cap
    const totalMatches = connectedNodeIds.size;
    const truncated = totalMatches > state.maxTotalNodes;
    let finalNodeIds: Set<string>;

    if (truncated) {
      if (nodeRankingMode === 'subgraph') {
        const nodeDegrees = new Map<string, number>();
        candidateLinks.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
          nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
        });

        const topNodes = Array.from(connectedNodeIds)
          .filter(nodeId => nodeDegrees.has(nodeId))
          .sort((a, b) => (nodeDegrees.get(b) || 0) - (nodeDegrees.get(a) || 0))
          .slice(0, state.maxTotalNodes);

        finalNodeIds = new Set(topNodes);
      } else {
        finalNodeIds = new Set(this.selectTopNodesByDegree(connectedNodeIds, state.maxTotalNodes));
      }
    } else {
      finalNodeIds = connectedNodeIds;
    }

    // Step 7: Build final nodes and links
    const selectedNodeMap = new Map<string, GraphNode>();
    this.allNodes.forEach(n => {
      if (finalNodeIds.has(n.id)) {
        const typeMatch = state.allowedNodeTypes.length === 0 ||
                          state.allowedNodeTypes.includes(n.node_type);
        if (typeMatch) selectedNodeMap.set(n.id, n);
      }
    });

    const nodes = Array.from(selectedNodeMap.values());

    const links = candidateLinks
      .filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return selectedNodeMap.has(sourceId) && selectedNodeMap.has(targetId);
      })
      .map(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return {
          source: sourceId,
          target: targetId,
          action: link.action,
          edge_type: link.edge_type,
          time: link.time,
          usc_title: link.usc_title,
          source_title: link.source_title,
          weight: link.weight,
          definition: link.definition,
          location: link.location,
          timestamp: link.timestamp,
        };
      });

    // Step 8: Compute colors by node type and degree
    const nodeDegree = new Map<string, number>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      nodeDegree.set(sourceId, (nodeDegree.get(sourceId) || 0) + 1);
      nodeDegree.set(targetId, (nodeDegree.get(targetId) || 0) + 1);
    });

    nodes.forEach(node => {
      node.val = nodeDegree.get(node.id) || 1;
      node.totalVal = node.val;
    });

    const maxVal = Math.max(...nodes.map(n => n.val), 1);
    const strength = (v: number) => v / maxVal;

    const sectionColorScale = (t: number) => {
      const r1 = 0x9B, g1 = 0x96, b1 = 0xC9;
      const r2 = 0x41, g2 = 0x37, b2 = 0x8F;
      return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
    };

    const entityConceptColorScale = (t: number) => {
      const r1 = 0xF9, g1 = 0xD9, b1 = 0x9B;
      const r2 = 0xF0, g2 = 0xA7, b2 = 0x34;
      return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
    };

    nodes.forEach(node => {
      const t = strength(node.val);
      let color: string;

      if (node.node_type === 'section' || node.node_type === 'index') {
        color = sectionColorScale(t);
      } else if (node.node_type === 'entity' || node.node_type === 'concept') {
        color = entityConceptColorScale(t);
      } else {
        color = '#AFBBE8';
      }

      node.color = color;
      node.baseColor = color;
    });

    return { nodes, links, truncated, matchedCount: totalMatches };
  }

  private selectTopNodesByDegree(nodeIds: Set<string>, maxNodes: number): string[] {
    const nodeDegrees = new Map<string, number>();

    nodeIds.forEach(nodeId => {
      const neighbors = this.adjacencyMap.get(nodeId) || [];
      nodeDegrees.set(nodeId, neighbors.length);
    });

    return Array.from(nodeDegrees.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxNodes)
      .map(([nodeId]) => nodeId);
  }
}