// src/types.ts

export type NodeType = 'section' | 'entity' | 'concept' | 'index';

export type TimeScope = string;

export type SelectedNode = {
  id: string;
  scope: TimeScope;
} | null;

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  node_type: NodeType;

  // Dataset scope fields
  time?: TimeScope;         // Year string e.g. "2025"
  // NOTE: 'title' is dual-purpose depending on node_type:
  //   - term nodes  → USC number as string, e.g. "26"
  //   - index nodes → hierarchy text, e.g. "TITLE 26" (may overwrite USC number)
  title?: string | null;

  // Runtime computed properties
  val?: number;
  totalVal?: number;
  color?: string;
  baseColor?: string;

  // Hierarchy fields (index nodes only, parsed from named_path)
  subtitle?: string | null;
  part?: string | null;
  subpart?: string | null;
  chapter?: string | null;
  subchapter?: string | null;
  section?: string | null;
  section_code?: string | null;
  subsection?: string | null;
  paragraph?: string | null;
  subparagraph?: string | null;
  clause?: string | null;
  subclause?: string | null;
  display_label?: string | null;
  index_heading?: string;

  // Properties from CSV data
  properties?: {
    full_name?: string;
    text?: string;
    definition?: string;
    [key: string]: any;
  };

  // Legacy compatibility
  full_name?: string;
  text?: string;
  section_text?: string | null;
  term_type?: string;

  // D3 simulation (inherited from d3.SimulationNodeDatum)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  edge_type: 'definition' | 'reference' | 'hierarchy';
  action: string;
  time?: TimeScope;
  title?: string;       // USC title number written by Python, e.g. "26"
  definition?: string;
  location?: string;
  timestamp?: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ManifestTitle {
  id: string;
  name: string;
  description?: string;
  timeScopes: string[];
  timeScopeType?: 'year' | 'version' | 'scenario' | 'custom';
}

export interface Manifest {
  version: number;
  titles: ManifestTitle[];
}

export interface NetworkBuilderState {
  searchTerms: string[];
  searchFields: (
    | 'text'
    | 'full_name'
    | 'display_label'
    | 'definition'
    | 'entity'
    | 'concept'
    | 'properties'
  )[];
  allowedNodeTypes: ('section' | 'entity' | 'concept' | 'index')[];
  allowedEdgeTypes: ('definition' | 'reference' | 'hierarchy')[];
  allowedTitles: string[];
  allowedYears: string[];
  seedNodeIds: string[];
  expansionDepth: number;
  maxNodesPerExpansion: number;
  maxTotalNodes: number;
}

export interface FilteredGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  truncated: boolean;
  matchedCount: number;
}
