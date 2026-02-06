// src/types.ts

export type NodeType = 'section' | 'entity' | 'concept' | 'index';

// Change TimeScope to be a year string (e.g., "2015", "2024")
export type TimeScope = string;

export type SelectedNode = {
  id: string;
  scope: TimeScope;
} | null;

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  node_type: NodeType;

  // Dataset scope fields - now 'time' is a year string
  time?: TimeScope;
  usc_title?: string;     // ← NEW: USC Title number from JSON ("26", "27", etc.)
  source_title?: string;  // ← KEEP: Legacy field if used elsewhere

  // Runtime computed properties
  val?: number;
  totalVal?: number;
  color?: string;
  baseColor?: string;

  // Hierarchy fields (parsed from node name)
  title?: string | null;        // ← UNCHANGED: Hierarchy title text "TITLE 26"
  subtitle?: string | null;
  part?: string | null;
  chapter?: string | null;
  subchapter?: string | null;
  section?: string | null;
  subsection?: string | null;
  display_label?: string | null;

  // Properties from CSV data
  properties?: {
    full_name?: string;
    text?: string;
    definition?: string;
    [key: string]: any;
  };

  // Legacy compatibility (mapped from properties or hierarchy)
  full_name?: string;
  text?: string;
  section_text?: string | null;
  term_type?: string;
  index_heading?: string;

  // D3 simulation properties (inherited from d3.SimulationNodeDatum)
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

  // Dataset scope fields - now 'time' is a year string
  time?: TimeScope;
  usc_title?: string;     // ← NEW: USC Title number from JSON ("26", "27", etc.)
  source_title?: string;  // ← KEEP: Legacy field if used elsewhere

  definition?: string;
  location?: string;
  timestamp?: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Relationship {
  id: number;
  doc_id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  target: string;
  location: string | null;
  tags: string[];

  actor_type?: NodeType;
  target_type?: NodeType;
  actor_id?: string;
  target_id?: string;
  definition?: string;
  actor_display_label?: string;
  target_display_label?: string;
}

export interface Actor {
  id: string;
  name: string;
  connection_count: number;
  time?: TimeScope;
}

export interface Stats {
  totalDocuments: { count: number };
  totalTriples: { count: number };
  totalActors: { count: number };
  categories: { category: string; count: number }[];
}

export interface Document {
  doc_id: string;
  file_path: string;
  one_sentence_summary: string;
  paragraph_summary: string;
  category: string;
  date_range_earliest: string | null;
  date_range_latest: string | null;

  full_name?: string;
  text?: string;
  title?: string | null;
  subtitle?: string | null;
  part?: string | null;
  chapter?: string | null;
  subchapter?: string | null;
  section?: string | null;
  subsection?: string | null;
}

export interface TagCluster {
  id: number;
  name: string;
  exemplars: string[];
  tagCount: number;
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
  allowedTitles: number[];
  allowedSections: string[];
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

// ==============================
// FLEXIBLE MANIFEST - Works for years, pre/post, versions, etc.
// ==============================

export interface ManifestTitle {
  id: string;                 // "26", "obbba-analysis", "custom-upload", etc.
  name: string;               // "Internal Revenue Code", "OBBBA Comparison"
  description?: string;       // Optional longer description
  timeScopes: string[];       // ← CHANGED from 'years' to 'timeScopes'
                              // Can be: ["2015", "2016", ...] OR ["pre-OBBBA", "post-OBBBA"]
  timeScopeType?: 'year' | 'version' | 'scenario' | 'custom';  // ← NEW: Optional hint for UI
}

export interface Manifest {
  version: number;            // Format version (currently 1)
  titles: ManifestTitle[];    // Array of available titles/datasets
}