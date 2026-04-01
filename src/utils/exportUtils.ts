/**
 * Export utilities for network graph data
 * Designed to be extensible for future network metrics integration
 */

import type { GraphNode, GraphLink, TimeScope, SelectedNode } from '../types';

// Maximum characters per CSV cell (Excel limit is 32,767)
const MAX_CELL_LENGTH = 32000;

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface ExportMetadata {
  year?: TimeScope | null;
  title?: string | null;
  filterTypes?: string[] | null;
  searchTerm?: string | null;
}

interface ExportOptions extends ExportMetadata {
  format?: 'separate' | 'edgelist';
}

interface FilenameOptions {
  type?: 'nodes' | 'links' | 'edgelist';
  year?: string;
  title?: string;
  filter?: string;
  timestamp?: boolean;
}

interface PNGExportOptions {
  backgroundColor?: string;
  scale?: number;
  includeLabels?: boolean;
}

interface ImageMetadata {
  title?: string;
  timeScope?: TimeScope;
  buildMode?: 'topDown' | 'bottomUp';
  nodeCount?: number;
  selectedNode?: SelectedNode;
}

/**
 * Escapes and cleans a value for safe CSV output.
 * Always wraps in double-quotes if the value contains commas, newlines, or double-quotes.
 * Internal double-quotes are escaped by doubling them ("").
 */
export function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.includes('"')
  ) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Normalizes a node field value before CSV escaping.
 * - Strips ALL control characters (0x00–0x1F, 0x7F) and Unicode line terminators
 * - Collapses whitespace
 * - Truncates to MAX_CELL_LENGTH to prevent Excel overflow corruption
 */
function normalizeField(value: any, truncate = true): string {
  if (value === null || value === undefined) return '';
  
  let str = String(value);
  
  // Strip ALL control characters (newlines, tabs, null bytes, etc.)
  // and Unicode line/paragraph separators
  str = str.replace(/[\x00-\x1F\x7F\u0085\u2028\u2029]/g, ' ');
  
  // Collapse multiple spaces into one
  str = str.replace(/ {2,}/g, ' ').trim();
  
  // Truncate to prevent Excel cell overflow
  if (truncate && str.length > MAX_CELL_LENGTH) {
    str = str.slice(0, MAX_CELL_LENGTH) + '... [TRUNCATED]';
  }
  
  return str;
}

/**
 * Converts nodes array to CSV string.
 * CLEAN FORMAT: Headers row, then one data row per node.
 * 
 * NOTE: 'section_text' is omitted because it is always identical to 'text'.
 * This halves row length for nodes with large statutory text.
 */
export function nodesToCSV(nodes: GraphNode[], metadata: ExportMetadata = {}): string {
  if (!nodes || nodes.length === 0) {
    return 'No nodes to export';
  }

  const headers = [
    'id', 'name', 'node_type', 'time', 'usc_title', 'source_title',
    'display_label', 'title', 'subtitle', 'part', 'chapter', 'subchapter',
    'section', 'subsection', 'full_name', 'text', 'term_type',
    'degree', 'betweenness_centrality', 'closeness_centrality',
    'eigenvector_centrality', 'pagerank', 'clustering_coefficient',
  ];

  let csv = headers.map(escapeCSVField).join(',') + '\n';

  nodes.forEach(node => {
    const row = headers.map(header => {
      const raw = (node as any)[header] ?? '';
      // Only truncate known long-text fields
      const shouldTruncate = header === 'text' || header === 'section_text' || header === 'full_name';
      const value = normalizeField(raw, shouldTruncate);
      return escapeCSVField(value);
    });
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Converts links array to CSV string.
 * CLEAN FORMAT: Headers row, then one data row per link.
 */
export function linksToCSV(links: GraphLink[], metadata: ExportMetadata = {}): string {
  if (!links || links.length === 0) {
    return 'No links to export';
  }

  const allKeys = new Set<string>();
  links.forEach(link => {
    Object.keys(link).forEach(key => allKeys.add(key));
  });

  const headers = ['source', 'target', ...Array.from(allKeys).filter(k => k !== 'source' && k !== 'target')];

  let csv = headers.map(escapeCSVField).join(',') + '\n';

  links.forEach(link => {
    const row = headers.map(header => {
      let value = (link as any)[header];
      if (typeof value === 'object' && value !== null) {
        value = value.id ?? value.toString();
      }
      return escapeCSVField(normalizeField(value ?? '', true));
    });
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Converts nodes and links to combined edge list CSV.
 * CLEAN FORMAT: Headers row, then one data row per edge.
 */
export function toEdgeListCSV(nodes: GraphNode[], links: GraphLink[], metadata: ExportMetadata = {}): string {
  if (!links || links.length === 0) {
    return 'No links to export';
  }

  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  const headers = [
    'source_id',
    'source_type',
    'source_label',
    'target_id',
    'target_type',
    'target_label',
    'edge_type',
    'action',
  ];

  let csv = headers.join(',') + '\n';

  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const sourceNode = nodeMap.get(sourceId) || ({} as GraphNode);
    const targetNode = nodeMap.get(targetId) || ({} as GraphNode);

    const row = [
      escapeCSVField(normalizeField(sourceId, false)),
      escapeCSVField(normalizeField(sourceNode.node_type || '', false)),
      escapeCSVField(normalizeField(sourceNode.name || '', false)),
      escapeCSVField(normalizeField(targetId, false)),
      escapeCSVField(normalizeField(targetNode.node_type || '', false)),
      escapeCSVField(normalizeField(targetNode.name || '', false)),
      escapeCSVField(normalizeField(link.edge_type || '', false)),
      escapeCSVField(normalizeField(link.action || '', false)),
    ];
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Triggers browser download of CSV content.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const BOM = '\uFEFF'; // UTF-8 BOM so Excel opens the file correctly
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Generates filename with timestamp and metadata.
 */
export function generateFilename(options: FilenameOptions = {}): string {
  const {
    type = 'nodes',
    year = '',
    title = '',
    filter = '',
    timestamp = true,
  } = options;

  let filename = 'taxcode';
  if (title) filename += `_${title}`;
  if (year) filename += `_${year}`;
  if (filter) filename += `_${filter}`;
  filename += `_${type}`;
  if (timestamp) {
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    filename += `_${date}`;
  }
  filename += '.csv';

  return filename;
}

/**
 * Main export function — orchestrates the export process.
 */
export function exportGraphData(graphData: GraphData, options: ExportOptions = {}): void {
  const {
    format = 'separate',
    year = null,
    title = null,
    filterTypes = null,
    searchTerm = null,
  } = options;

  const metadata: ExportMetadata = { year, title, filterTypes, searchTerm };

  if (format === 'edgelist') {
    const csv = toEdgeListCSV(graphData.nodes, graphData.links, metadata);
    const filename = generateFilename({
      type: 'edgelist',
      year: year || '',
      title: title || '',
      filter: filterTypes ? filterTypes.join('-') : 'all',
    });
    downloadCSV(csv, filename);
  } else {
    const nodesCSV = nodesToCSV(graphData.nodes, metadata);
    const linksCSV = linksToCSV(graphData.links, metadata);

    const nodesFilename = generateFilename({
      type: 'nodes',
      year: year || '',
      title: title || '',
      filter: filterTypes ? filterTypes.join('-') : 'all',
    });
    const linksFilename = generateFilename({
      type: 'links',
      year: year || '',
      title: title || '',
      filter: filterTypes ? filterTypes.join('-') : 'all',
    });

    downloadCSV(nodesCSV, nodesFilename);
    setTimeout(() => downloadCSV(linksCSV, linksFilename), 100);
  }
}

/**
 * Exports the current graph view as PNG.
 */
export function exportGraphToPNG(svgElement: SVGSVGElement, filename: string, options: PNGExportOptions = {}): void {
  const {
    backgroundColor = '#111827',
    scale = 2,
  } = options;

  try {
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width;
    const height = bbox.height;

    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));

    const gElement = svgElement.querySelector('g');
    const transform = gElement?.getAttribute('transform') || '';

    const clonedG = clonedSvg.querySelector('g');
    if (clonedG && transform) {
      clonedG.setAttribute('transform', transform);
    }

    const overlays = clonedSvg.querySelectorAll('foreignObject, .overlay');
    overlays.forEach(el => el.remove());

    const serializer = new XMLSerializer();
    const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${serializer.serializeToString(clonedSvg)}`;

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        URL.revokeObjectURL(url);
        return;
      }

      ctx.scale(scale, scale);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create PNG blob');
          URL.revokeObjectURL(url);
          return;
        }

        const link = document.createElement('a');
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();

        URL.revokeObjectURL(url);
        URL.revokeObjectURL(link.href);
      }, 'image/png');
    };

    img.onerror = (error) => {
      console.error('Error loading SVG into image:', error);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  } catch (error) {
    console.error('Error exporting graph to PNG:', error);
    throw error;
  }
}

/**
 * Main export orchestrator for PNG.
 */
export function exportGraphImage(svgElement: SVGSVGElement, metadata: ImageMetadata = {}): void {
  const {
    title = '26',
    timeScope = '2025',
    buildMode = 'topDown',
    nodeCount = 0,
    selectedNode = null,
  } = metadata;

  let filename = `taxcode_title${title}_${timeScope}_${buildMode}`;
  if (selectedNode) {
    filename += `_node-${selectedNode.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }
  filename += `_${nodeCount}nodes`;
  filename += `_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.png`;

  exportGraphToPNG(svgElement, filename, {
    backgroundColor: '#111827',
    scale: 2,
  });
}