import { useState } from 'react';
import type { GraphNode, GraphLink, TimeScope, SelectedNode } from '../types';
import { exportGraphData, exportGraphImage } from '../utils/exportUtils';

interface ExportControlsProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] } | null;
  exportNodes?: GraphNode[];
  buildMode: 'topDown' | 'bottomUp';
  timeScope: TimeScope;
  selectedTitle: string;
  selectedNode: SelectedNode;
  filterTypes?: string[];
  searchTerm?: string;
  svgElement: SVGSVGElement | null;
  displayGraphInfo?: {
    nodeCount: number;
    linkCount: number;
    truncated: boolean;
    matchedCount: number;
  } | null;
}

export default function ExportControls({
  graphData,
  exportNodes,
  buildMode,
  timeScope,
  selectedTitle,
  selectedNode,
  filterTypes,
  searchTerm,
  svgElement,
  displayGraphInfo,
}: ExportControlsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'separate' | 'edgelist'>('separate');

  const effectiveNodes = exportNodes ?? graphData?.nodes ?? [];
  const effectiveLinks = graphData?.links ?? [];

  const hasData = effectiveNodes.length > 0;
  const nodeCount = effectiveNodes.length;
  const linkCount = effectiveLinks.length;

  const handleExportCSV = async () => {
    if (effectiveNodes.length === 0) {
      alert('No data to export. Please load or search for data first.');
      return;
    }

    setIsExporting(true);

    try {

console.log('Node keys:', Object.keys(effectiveNodes[0]));
console.log('Sample node:', JSON.stringify(effectiveNodes[0], null, 2));
      const metadata = {
        year: timeScope,
        title: `Title ${selectedTitle}`,
        filterTypes: filterTypes || null,
        searchTerm: searchTerm || null,
      };

      exportGraphData(
        { nodes: effectiveNodes, links: effectiveLinks },
        { format: exportFormat, ...metadata }
      );

      if (displayGraphInfo?.truncated) {
        alert(
          `✅ Exported ${nodeCount} nodes and ${linkCount} links.\n\n` +
          `⚠️ Note: This is a filtered subset of ${displayGraphInfo.matchedCount} total matching nodes.`
        );
      } else {
        alert(`✅ Exported ${nodeCount} nodes and ${linkCount} links successfully!`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('❌ Export failed. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    if (!svgElement) {
      alert('Graph is not ready for export. Please wait for it to load.');
      return;
    }

    setIsExporting(true);

    try {
      const metadata = {
        title: selectedTitle,
        timeScope,
        buildMode,
        nodeCount: effectiveNodes.length,
        selectedNode,
      };

      exportGraphImage(svgElement, metadata);

      setTimeout(() => {
        alert('✅ PNG export started! Check your downloads.');
      }, 100);
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('❌ PNG export failed. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Export Data</h3>

        {/* Export info */}
        {hasData && (
          <div className="text-xs text-gray-400 mb-3 bg-gray-800 p-2 rounded">
            <div>📊 {nodeCount} nodes, {linkCount} links</div>
            {exportNodes && exportNodes.length > (graphData?.nodes.length ?? 0) && (
              <div className="text-blue-400 mt-1">
                ✚ Includes {exportNodes.length - (graphData?.nodes.length ?? 0)} isolated nodes
              </div>
            )}
            {displayGraphInfo?.truncated && (
              <div className="text-yellow-400 mt-1">
                ⚠️ Showing {nodeCount} of {displayGraphInfo.matchedCount} nodes
              </div>
            )}
          </div>
        )}

        {/* CSV Export Options */}
        <div className="space-y-2 mb-3">
          <label className="text-xs text-gray-400">CSV Format:</label>
          <div className="space-y-1">
            <label className="flex items-center text-xs text-gray-300">
              <input
                type="radio"
                name="exportFormat"
                value="separate"
                checked={exportFormat === 'separate'}
                onChange={(e) => setExportFormat(e.target.value as 'separate')}
                className="mr-2"
              />
              Separate files (nodes.csv + links.csv)
            </label>
            <label className="flex items-center text-xs text-gray-300">
              <input
                type="radio"
                name="exportFormat"
                value="edgelist"
                checked={exportFormat === 'edgelist'}
                onChange={(e) => setExportFormat(e.target.value as 'edgelist')}
                className="mr-2"
              />
              Single file (edge list)
            </label>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!hasData || isExporting}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
              hasData && !isExporting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isExporting ? '⏳' : '📊 CSV'}
          </button>

          <button
            onClick={handleExportPNG}
            disabled={!hasData || isExporting}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
              hasData && !isExporting
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isExporting ? '⏳' : '🖼️ PNG'}
          </button>
        </div>

        {/* Export Info */}
        {!hasData && (
          <p className="text-xs text-gray-500 mt-2">
            Load graph data or perform a search to enable export.
          </p>
        )}

        {hasData && (
          <div className="text-xs text-gray-400 mt-3 space-y-1">
            <div>💡 CSV includes metadata and empty metric columns for future analysis</div>
            <div>💡 PNG captures current zoom/pan view</div>
          </div>
        )}
      </div>
    </div>
  );
}
