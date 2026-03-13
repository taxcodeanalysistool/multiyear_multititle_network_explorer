// src/components/TableView.tsx  ← Multi-title, multi-year version

import { useState, useMemo } from 'react';
import type { GraphNode, GraphLink } from '../types';

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNodeId?: string | null;
  onNodeClick: (id: string | null) => void;
}

type SortKey =
  | 'id' | 'name' | 'node_type' | 'time' | 'usc_title'
  | 'title' | 'subtitle' | 'chapter' | 'subchapter' | 'part'
  | 'section' | 'subsection' | 'display_label' | 'index_heading'
  | 'degree' | 'definition' | 'text';

type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 1000;

const ALL_COLUMNS: { key: SortKey; label: string; defaultVisible: boolean }[] = [
  { key: 'display_label', label: 'Label',             defaultVisible: true  },
  { key: 'usc_title',     label: 'USC Title',          defaultVisible: true  },
  { key: 'time',          label: 'Year',               defaultVisible: true  },
  { key: 'section',       label: 'Section',            defaultVisible: true  },
  { key: 'subsection',    label: 'Subsection',         defaultVisible: true  },
  { key: 'node_type',     label: 'Type',               defaultVisible: true  },
  { key: 'degree',        label: 'Connections',        defaultVisible: true  },
  { key: 'chapter',       label: 'Chapter',            defaultVisible: false },
  { key: 'subchapter',    label: 'Subchapter',         defaultVisible: false },
  { key: 'part',          label: 'Part',               defaultVisible: false },
  { key: 'subtitle',      label: 'Subtitle',           defaultVisible: false },
  { key: 'title',         label: 'Title (hierarchy)',  defaultVisible: false },
  { key: 'index_heading', label: 'Index Heading',      defaultVisible: false },
  { key: 'definition',    label: 'Definition',         defaultVisible: false },
  { key: 'text',          label: 'Full Text',          defaultVisible: false },
  { key: 'id',            label: 'ID',                 defaultVisible: false },
  { key: 'name',          label: 'Name',               defaultVisible: false },
];

function getCellValue(
  node: GraphNode,
  key: SortKey,
  degreeMap: Map<string, number>
): string | number {
  if (key === 'degree')     return degreeMap.get(node.id) || 0;
  if (key === 'definition') return node.properties?.definition || '—';
  if (key === 'text')       return node.properties?.text || '—';
  const val = (node as any)[key];
  if (val === null || val === undefined) return '—';
  return val;
}

function renderCell(
  node: GraphNode,
  key: SortKey,
  degreeMap: Map<string, number>
) {
  const val = getCellValue(node, key, degreeMap);

  if (key === 'id') return (
    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#ffffff' }}>
      {String(val)}
    </span>
  );

  if (key === 'display_label') return (
    <span style={{ color: '#93c5fd', fontWeight: 500 }}>{String(val)}</span>
  );

  if (key === 'usc_title') return (
    <span style={{ color: '#ffffff', fontWeight: 500 }}>
      {val === '—' ? '—' : `Title ${val}`}
    </span>
  );

  if (key === 'time') return (
    <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>{String(val)}</span>
  );

  if (key === 'degree') return (
    <span style={{ color: '#ffffff' }}>{String(val)}</span>
  );

  if (key === 'node_type') return (
    <span style={{ color: '#ffffff' }}>{String(val)}</span>
  );

  if (key === 'definition' || key === 'text') return (
    <span style={{
      fontSize: '0.75rem',
      color: '#ffffff',
      whiteSpace: 'normal',
      maxWidth: '400px',
      display: 'block',
    }}>
      {String(val)}
    </span>
  );

  return <span style={{ color: '#ffffff' }}>{String(val)}</span>;
}

export default function TableView({ nodes, links, selectedNodeId, onNodeClick }: Props) {
  const [sortKey, setSortKey]           = useState<SortKey>('degree');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [globalFilter, setGlobalFilter] = useState('');
  const [visibleCols, setVisibleCols]   = useState<Set<SortKey>>(
    new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  );
  const [showColPicker, setShowColPicker] = useState(false);
  const [colFilters, setColFilters]     = useState<Partial<Record<SortKey, string>>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    links.forEach((l) => {
      const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      map.set(s, (map.get(s) || 0) + 1);
      map.set(t, (map.get(t) || 0) + 1);
    });
    return map;
  }, [links]);

  const activeCols = ALL_COLUMNS.filter((c) => visibleCols.has(c.key));

  const sorted = useMemo(() => {
    let filtered = nodes;

    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase();
      filtered = filtered.filter((n) =>
        ALL_COLUMNS.some((col) =>
          String(getCellValue(n, col.key, degreeMap)).toLowerCase().includes(q)
        )
      );
    }

    Object.entries(colFilters).forEach(([key, val]) => {
      if (!val?.trim()) return;
      const q = val.toLowerCase();
      filtered = filtered.filter((n) =>
        String(getCellValue(n, key as SortKey, degreeMap)).toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const valA = getCellValue(a, sortKey, degreeMap);
      const valB = getCellValue(b, sortKey, degreeMap);
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [nodes, sortKey, sortDir, globalFilter, colFilters, degreeMap]);

  const resetPagination = () => setVisibleCount(PAGE_SIZE);
  const visibleRows = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const remaining = Math.min(PAGE_SIZE, sorted.length - visibleCount);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    resetPagination();
  };

  const toggleCol = (key: SortKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#111827', color: 'white' }}>

      {/* Toolbar */}
      <div style={{ flexShrink: 0 }} className="p-3 border-b border-gray-700 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(e) => { setGlobalFilter(e.target.value); resetPagination(); }}
          className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500"
        />
        <span className="text-sm text-gray-400">
          Showing {Math.min(visibleCount, sorted.length).toLocaleString()} of {sorted.length.toLocaleString()} nodes
          {sorted.length !== nodes.length && ` (filtered from ${nodes.length.toLocaleString()})`}
        </span>

        <div className="relative ml-auto">
          <button
            onClick={() => setShowColPicker((v) => !v)}
            className="px-3 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded hover:border-gray-400 transition-colors"
          >
            Columns ⚙
          </button>
          {showColPicker && (
            <div className="absolute right-0 top-9 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-56 grid grid-cols-1 gap-1 max-h-96 overflow-y-auto">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-white text-gray-300">
                  <input
                    type="checkbox"
                    checked={visibleCols.has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="accent-blue-500"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <table style={{ minWidth: 'max-content', width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1f2937', zIndex: 10 }}>
            <tr>
              {activeCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{
                    padding: '8px 16px',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                >
                  {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
            <tr style={{ backgroundColor: '#1f2937' }}>
              {activeCols.map((col) => (
                <th key={col.key} style={{ padding: '4px 8px' }}>
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={colFilters[col.key] || ''}
                    onChange={(e) => {
                      setColFilters((prev) => ({ ...prev, [col.key]: e.target.value }));
                      resetPagination();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      backgroundColor: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      color: 'white',
                      outline: 'none',
                      fontWeight: 'normal',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((node) => {
              const isSelected = node.id === selectedNodeId;
              return (
                <tr
                  key={node.id}
                  onClick={() => onNodeClick(isSelected ? null : node.id)}
                  style={{
                    borderTop: '1px solid #1f2937',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                    outline: isSelected ? '1px solid #3b82f6' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.backgroundColor = '#1f2937';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? '#1e3a5f' : 'transparent';
                  }}
                >
                  {activeCols.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '8px 16px',
                        whiteSpace: col.key === 'definition' || col.key === 'text' ? 'normal' : 'nowrap',
                        maxWidth: col.key === 'definition' || col.key === 'text' ? '400px' : '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {renderCell(node, col.key, degreeMap)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '64px 0' }}>
            No nodes match the current filters.
          </div>
        )}

        {hasMore && (
          <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid #1f2937' }}>
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #4b5563',
                borderRadius: '8px',
                color: '#d1d5db',
                padding: '10px 24px',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#9ca3af')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#4b5563')}
            >
              Load {remaining.toLocaleString()} more
              <span style={{ color: '#6b7280', marginLeft: '8px' }}>
                ({(sorted.length - visibleCount).toLocaleString()} remaining)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
