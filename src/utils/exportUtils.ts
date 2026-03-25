/**
 * Export utilities for network graph data
 * Designed to be extensible for future network metrics integration
 */

import type { GraphNode, GraphLink, TimeScope, SelectedNode } from '../types';

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
 */
export function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  // Normalize internal newlines and tabs to a single space
  const stringField = String(field).replace(/[\r\n\t]+/g, ' ').trim();
  // Wrap in quotes if field contains a comma, double-quote, or was multi-line
  if (stringField.includes(',') || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
}

/**
 * Converts nodes array to CSV string.
 * CLEAN FORMAT: Headers row, then data rows, then blank line + metadata section.
 */
export function nodesToCSV(nodes: GraphNode[], metadata: ExportMetadata = {}): string {
  if (!nodes || nodes.length === 0) {
    return 'No nodes to export';
  }

  // Get all unique keys from nodes (for extensibility with future metrics)
  const allKeys = new Set<string>();
  nodes.forEach(node => {
    Object.keys(node).forEach(key => allKeys.add(key));
  });

  // Reserve space for future metric columns (will be empty now)
  const metricColumns = [
    'degree',
    'betweenness_centrality',
    'closeness_centrality',
    'eigenvector_centrality',
    'pagerank',
    'clustering_coefficient',
  ];

  const headers = [...Array.from(allKeys), ...metricColumns];
  
  // Start with clean header row
  let csv = headers.map(escapeCSVField).join(',') + '\n';

  // Add data rows
  nodes.forEach(node => {
    const row = headers.map(header => escapeCSVField((node as any)[header] ?? ''));
    csv += row.join(',') + '\n';
  });

  // Add metadata section at the end (after blank line)
  csv += '\n';
  csv += '# METADATA\n';
  if (metadata.year) csv += `# Year: ${metadata.year}\n`;
  if (metadata.title) csv += `# Title: ${metadata.title}\n`;
  if (metadata.filterTypes) csv += `# Filtered Types: ${metadata.filterTypes.join(', ')}\n`;
  if (metadata.searchTerm) csv += `# Search Term: ${metadata.searchTerm}\n`;
  csv += `# Export Date: ${new Date().toISOString()}\n`;
  csv += `# Total Nodes: ${nodes.length}\n`;

  return csv;
}

/**
 * Converts links array to CSV string.
 * CLEAN FORMAT: Headers row, then data rows, then blank line + metadata section.
 */
export function linksToCSV(links: GraphLink[], metadata: ExportMetadata = {}): string {
  if (!links || links.length === 0) {
    return 'No links to export';
  }

  // Get all unique keys from links
  const allKeys = new Set<string>();
  links.forEach(link => {
    Object.keys(link).forEach(key => allKeys.add(key));
  });

  // Ensure source and target are first columns
  const headers = ['source', 'target', ...Array.from(allKeys).filter(k => k !== 'source' && k !== 'target')];
  
  // Start with clean header row
  let csv = headers.map(escapeCSVField).join(',') + '\n';

  // Add data rows
  links.forEach(link => {
    const row = headers.map(header => {
      let value = (link as any)[header];
      // Handle D3 object references (source/target might be objects)
      if (typeof value === 'object' && value !== null) {
        value = value.id ?? value.toString();
      }
      return escapeCSVField(value ?? '');
    });
    csv += row.join(',') + '\n';
  });

  // Add metadata section at the end (after blank line)
  csv += '\n';
  csv += '# METADATA\n';
  if (metadata.year) csv += `# Year: ${metadata.year}\n`;
  if (metadata.title) csv += `# Title: ${metadata.title}\n`;
  csv += `# Export Date: ${new Date().toISOString()}\n`;
  csv += `# Total Links: ${links.length}\n`;

  return csv;
}

/**
 * Converts nodes and links to combined edge list CSV.
 * CLEAN FORMAT: Headers row, then data rows, then blank line + metadata section.
 */
export function toEdgeListCSV(nodes: GraphNode[], links: GraphLink[], metadata: ExportMetadata = {}): string {
  if (!links || links.length === 0) {
    return 'No links to export';
  }

  // Create node lookup for attributes
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // Headers: source info, target info, edge attributes
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
  
  // Start with clean header row
  let csv = headers.join(',') + '\n';

  // Add data rows
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const sourceNode = nodeMap.get(sourceId) || ({} as GraphNode);
    const targetNode = nodeMap.get(targetId) || ({} as GraphNode);

    const row = [
      escapeCSVField(sourceId),
      escapeCSVField(sourceNode.node_type || ''),
      escapeCSVField(sourceNode.name || ''),
      escapeCSVField(targetId),
      escapeCSVField(targetNode.node_type || ''),
      escapeCSVField(targetNode.name || ''),
      escapeCSVField(link.edge_type || ''),
      escapeCSVField(link.action || ''),
    ];
    csv += row.join(',') + '\n';
  });

  // Add metadata section at the end (after blank line)
  csv += '\n';
  csv += '# METADATA\n';
  if (metadata.year) csv += `# Year: ${metadata.year}\n`;
  if (metadata.title) csv += `# Title: ${metadata.title}\n`;
  csv += `# Export Date: ${new Date().toISOString()}\n`;
  csv += `# Format: Edge List with Node Attributes\n`;
  csv += `# Total Edges: ${links.length}\n`;

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
