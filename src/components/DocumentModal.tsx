// src/components/DocumentModal.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchDocument, fetchDocumentText, fetchNodeDetails } from '../api';
import type { Document, TimeScope } from '../types';
import DiffViewer from './DiffViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentModalProps {
  docId: string;
  highlightTerm: string | null;
  secondaryHighlightTerm?: string | null;
  searchKeywords?: string;
  useRegex?: boolean;
  timeScope: TimeScope;
  onTimeScopeChange: (scope: TimeScope) => void;
  onClose: () => void;
  selectedTitle: string;
  availableTimeScopes: string[];
  isGraphLoading: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

interface MatchPosition {
  index: number;
  term: string;
  type: 'primary' | 'secondary' | 'search';
  percentage: number;
}

type ViewMode = 'original' | 'track-changes' | 'new';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMMON_WORDS = new Set([
  'the', 'and', 'or', 'to', 'from', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'since', 'without', 'within', 'of', 'off',
  'out', 'over', 'up', 'down', 'near', 'along', 'among', 'across', 'behind',
  'beyond', 'plus', 'except', 'but', 'per', 'via', 'upon', 'against',
]);

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentModal({
  docId,
  highlightTerm,
  secondaryHighlightTerm,
  searchKeywords,
  useRegex = false,
  timeScope,
  onTimeScopeChange,
  onClose,
  selectedTitle,
  availableTimeScopes,
  isGraphLoading,
  onNext,
  onPrev,
  currentIndex,
  totalCount,
}: DocumentModalProps) {
  const [document, setDocument] = useState<Document | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchPositions, setMatchPositions] = useState<MatchPosition[]>([]);
  const [nodeNotFound, setNodeNotFound] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Track changes state
  const [viewMode, setViewMode] = useState<ViewMode>('new');
  const [priorText, setPriorText] = useState<string>('');

  // Derive prior scope — one step back in the sorted availableTimeScopes list
  const priorScope = useMemo(() => {
    const idx = availableTimeScopes.indexOf(String(timeScope));
    return idx > 0 ? availableTimeScopes[idx - 1] : null;
  }, [availableTimeScopes, timeScope]);

  // hasDiff: prior scope exists, both texts loaded, and they actually differ
  const hasDiff =
    !!priorScope &&
    priorText.trim().length > 0 &&
    documentText.trim().length > 0 &&
    priorText !== documentText;

  // Which text to display in non-diff views
  const displayText = viewMode === 'original' ? priorText || documentText : documentText;

  // Reset view mode and prior text whenever the doc or scope changes
  useEffect(() => {
    setViewMode('new');
    setPriorText('');
  }, [docId, timeScope]);

  // Eagerly fetch prior scope text alongside the current doc load
  useEffect(() => {
    if (!priorScope) return;
    let active = true;

    fetchDocumentText(docId, selectedTitle, priorScope as TimeScope)
      .then((data) => { if (active) setPriorText(data?.text || ''); })
      .catch(() => { if (active) setPriorText(''); });

    return () => { active = false; };
  }, [docId, selectedTitle, priorScope]);

  // Load current document metadata + text
  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      if (isGraphLoading) { setLoading(true); return; }

      setLoading(true);
      setError(null);
      setNodeNotFound(false);

      try {
        const [doc, textData, nodeDetails] = await Promise.all([
          fetchDocument(docId, selectedTitle, timeScope),
          fetchDocumentText(docId, selectedTitle, timeScope),
          fetchNodeDetails(docId, selectedTitle, timeScope),
        ]);

        if (!active) return;

        if (!nodeDetails) {
          setNodeNotFound(true);
          setDocument(null);
          setDocumentText('');
          setLoading(false);
          return;
        }

        setDocument({
          ...doc,
          title: nodeDetails?.title,
          subtitle: nodeDetails?.subtitle,
          full_name: nodeDetails?.full_name,
          text: nodeDetails?.text,
          part: nodeDetails?.part,
          chapter: nodeDetails?.chapter,
          subchapter: nodeDetails?.subchapter,
          section: nodeDetails?.section,
          subsection: nodeDetails?.subsection,
          display_label: nodeDetails?.display_label,
          index_heading: nodeDetails?.index_heading,
        });

        setDocumentText(textData.text);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Error loading document:', err);
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load section text');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDocument();
    return () => { active = false; };
  }, [docId, selectedTitle, timeScope, isGraphLoading]);

  useEffect(() => { matchRefs.current.clear(); }, [docId, timeScope]);

  // Match positions for scroll gutter — skipped in track-changes view
  useEffect(() => {
    if (!displayText || viewMode === 'track-changes') {
      setMatchPositions([]);
      return;
    }

    const positions: MatchPosition[] = [];
    const textLength = displayText.length;
    const searchPatterns: string[] = [];
    const primaryPatterns: string[] = [];
    const secondaryPatterns: string[] = [];

    if (searchKeywords) {
      if (useRegex) {
        try { new RegExp(searchKeywords.trim(), 'gi'); searchPatterns.push(searchKeywords.trim()); } catch {}
      } else {
        searchKeywords.split(',').forEach((keyword) => {
          const trimmed = keyword.trim();
          if (trimmed.length > 0)
            searchPatterns.push(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        });
      }
    }

    if (highlightTerm) {
      primaryPatterns.push(highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      highlightTerm.split(/\s+/).forEach((word) => {
        if (word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase()))
          primaryPatterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      });
    }

    if (secondaryHighlightTerm) {
      secondaryPatterns.push(secondaryHighlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      secondaryHighlightTerm.split(/\s+/).forEach((word) => {
        if (word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase()))
          secondaryPatterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      });
    }

    const pushMatches = (patterns: string[], type: MatchPosition['type']) => {
      if (!patterns.length) return;
      try {
        const re = new RegExp(`(${patterns.join('|')})`, 'gi');
        let match;
        while ((match = re.exec(displayText)) !== null)
          positions.push({ index: match.index, term: match[0], type, percentage: (match.index / textLength) * 100 });
      } catch {}
    };

    pushMatches(searchPatterns, 'search');
    pushMatches(primaryPatterns, 'primary');
    pushMatches(secondaryPatterns, 'secondary');
    positions.sort((a, b) => a.index - b.index);
    setMatchPositions(positions);
  }, [displayText, highlightTerm, secondaryHighlightTerm, searchKeywords, useRegex, viewMode]);

  const scrollToMatch = (index: number) => {
    matchRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ─── Highlight renderer ────────────────────────────────────────────────────

  const highlightText = (
    text: string,
    term: string | null,
    secondaryTerm: string | null,
    searchTerms: string | null,
    isRegex: boolean = false,
  ): JSX.Element[] => {
    if (!term && !secondaryTerm && !searchTerms) return [<span key="0">{text}</span>];

    try {
      const patterns: string[] = [];
      const searchWords = new Set<string>();
      const primaryWords = new Set<string>();
      const secondaryWords = new Set<string>();
      let searchRegexForMatching: RegExp | null = null;

      if (searchTerms) {
        if (isRegex) {
          try {
            searchRegexForMatching = new RegExp(`^(?:${searchTerms.trim()})$`, 'i');
            patterns.push(searchTerms.trim());
          } catch {}
        } else {
          searchTerms.split(',').forEach((keyword) => {
            const trimmed = keyword.trim();
            if (trimmed.length > 0) {
              searchWords.add(trimmed.toLowerCase());
              patterns.push(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            }
          });
        }
      }

      if (term) {
        patterns.push(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        term.split(/\s+/).forEach((word) => {
          if (word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase())) {
            primaryWords.add(word.toLowerCase());
            patterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          }
        });
      }

      if (secondaryTerm) {
        patterns.push(secondaryTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        secondaryTerm.split(/\s+/).forEach((word) => {
          if (word.length >= 3 && !COMMON_WORDS.has(word.toLowerCase())) {
            secondaryWords.add(word.toLowerCase());
            patterns.push(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          }
        });
      }

      const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
      const parts = text.split(regex);
      let currentIndex = 0;

      return parts.map((part, index) => {
        const partLower = part.toLowerCase();
        const partStart = currentIndex;
        currentIndex += part.length;

        let isSearchMatch = false;
        if (searchRegexForMatching) {
          isSearchMatch = searchRegexForMatching.test(part);
        } else {
          for (const searchWord of searchWords) {
            if (partLower.includes(searchWord) || searchWord.includes(partLower)) {
              isSearchMatch = true;
              break;
            }
          }
        }

        if (isSearchMatch)
          return <mark key={index} ref={(el) => { if (el) matchRefs.current.set(partStart, el); }} className="bg-green-300 text-black font-semibold px-1 rounded">{part}</mark>;
        if (term && (partLower === term.toLowerCase() || primaryWords.has(partLower)))
          return <mark key={index} ref={(el) => { if (el) matchRefs.current.set(partStart, el); }} className="bg-yellow-400 text-black px-1 rounded">{part}</mark>;
        if (secondaryTerm && (partLower === secondaryTerm.toLowerCase() || secondaryWords.has(partLower)))
          return <mark key={index} ref={(el) => { if (el) matchRefs.current.set(partStart, el); }} className="bg-orange-300 text-black px-1 rounded">{part}</mark>;
        return <span key={index}>{part}</span>;
      });
    } catch {
      return [<span key="0">{text}</span>];
    }
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col relative border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h2 className="text-2xl font-semibold text-blue-400">
                {document?.display_label || document?.name || document?.doc_id || docId}
              </h2>
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-purple-600 text-white">
                {timeScope}
              </span>
              <div className="ml-auto flex items-center gap-2 flex-wrap">

                {/* Time scope selector */}
                <select
                  value={timeScope}
                  onChange={(e) => { e.stopPropagation(); onTimeScopeChange(e.target.value); }}
                  className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  {availableTimeScopes.map((scope) => (
                    <option key={scope} value={scope}>{scope}</option>
                  ))}
                </select>

                {/* Track Changes toggle — only when both versions exist and differ */}
                {hasDiff && !loading && !nodeNotFound && (
                  <div className="flex rounded-lg overflow-hidden border border-gray-600 text-xs">
                    <button
                      onClick={() => setViewMode('new')}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        viewMode === 'new'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      New
                    </button>
                    <button
                      onClick={() => setViewMode('track-changes')}
                      className={`px-3 py-1.5 font-medium transition-colors border-l border-r border-gray-600 ${
                        viewMode === 'track-changes'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      Track Changes
                    </button>
                    <button
                      onClick={() => setViewMode('original')}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        viewMode === 'original'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      Original
                    </button>
                  </div>
                )}
              </div>
            </div>

            {nodeNotFound && (
              <div className="mb-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded">
                <div className="text-sm text-yellow-300 font-semibold">
                  This section does not exist in time scope: {timeScope}
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  Try selecting a different time scope to see if this section exists in other versions.
                </div>
              </div>
            )}

            {document && (document.title || document.part || document.chapter || document.subchapter || document.section) && (
              <div className="space-y-1 text-sm text-gray-300 mb-3 font-mono">
                {document.title      && <div><span className="text-gray-500">Title:</span> {document.title}</div>}
                {document.subtitle   && <div><span className="text-gray-500">Subtitle:</span> {document.subtitle}</div>}
                {document.part       && <div><span className="text-gray-500">Part:</span> {document.part}</div>}
                {document.chapter    && <div><span className="text-gray-500">Chapter:</span> {document.chapter}</div>}
                {document.subchapter && <div><span className="text-gray-500">Subchapter:</span> {document.subchapter}</div>}
                {document.section    && <div><span className="text-gray-500">Section:</span> {document.section}</div>}
                {document.subsection && <div><span className="text-gray-500">Subsection:</span> {document.subsection}</div>}
                {document.index_heading && document.index_heading.trim() !== '' && (
                  <div><span className="text-gray-500">Heading:</span> {document.index_heading}</div>
                )}
              </div>
            )}

            {document && document.full_name && !document.title && !document.section && (
              <h3 className="text-lg font-medium text-gray-400 mb-1">{document.full_name}</h3>
            )}
          </div>
          <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white text-2xl leading-none transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 pr-12 relative" ref={contentRef}>

          {/* Scroll gutter — hidden in track-changes view */}
          {viewMode !== 'track-changes' && !loading && !error && matchPositions.length > 0 && (
            <div className="absolute right-4 top-0 bottom-0 w-3 bg-gray-700/50 rounded-full pointer-events-none z-10">
              {matchPositions.map((match, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToMatch(match.index)}
                  className={`absolute w-3 h-3 rounded-full transform transition-all hover:scale-150 pointer-events-auto ${
                    match.type === 'search'  ? 'bg-green-300 hover:bg-green-200' :
                    match.type === 'primary' ? 'bg-yellow-400 hover:bg-yellow-300' :
                                               'bg-orange-300 hover:bg-orange-200'
                  }`}
                  style={{ top: `${match.percentage}%` }}
                  title={`${match.term} (${idx + 1}/${matchPositions.length})`}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400">Loading section text...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-4 text-red-300">{error}</div>
          )}

          {!loading && !error && nodeNotFound && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-center">
                <p className="text-lg">This section does not exist in {timeScope}.</p>
                <p className="text-sm mt-2">Select a different time scope from the dropdown above.</p>
              </div>
            </div>
          )}

          {!loading && !error && !nodeNotFound && (!documentText || documentText.trim() === '') && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-center">
                <p className="text-lg">Full text for this node is not available.</p>
              </div>
            </div>
          )}

          {!loading && !error && !nodeNotFound && documentText && documentText.trim() !== '' && (
            <div className="prose prose-invert max-w-none">
              {viewMode === 'track-changes' && hasDiff ? (
                <DiffViewer beforeText={priorText} afterText={documentText} />
              ) : (
                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-sm">
                  {highlightText(displayText, highlightTerm, secondaryHighlightTerm || null, searchKeywords || null, useRegex)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-500 flex gap-4 items-center flex-wrap">
            {viewMode === 'track-changes' && hasDiff && (
              <span>
                <span style={{ color: '#86efac' }} className="mr-2">■ Added</span>
                <span style={{ color: '#fca5a5' }}>■ Removed</span>
              </span>
            )}
            {viewMode !== 'track-changes' && (
              <>
                {searchKeywords && (
                  <span>
                    <span className="inline-block bg-green-300 text-black font-semibold px-2 py-0.5 rounded text-xs mr-1">
                      {useRegex ? `/${searchKeywords}/` : 'Search keywords'}
                    </span>
                  </span>
                )}
                {highlightTerm && (
                  <span>
                    <span className="inline-block bg-yellow-400 text-black px-2 py-0.5 rounded text-xs mr-1">
                      {highlightTerm}
                    </span>
                  </span>
                )}
                {secondaryHighlightTerm && (
                  <span>
                    <span className="inline-block bg-orange-300 text-black px-2 py-0.5 rounded text-xs mr-1">
                      {secondaryHighlightTerm}
                    </span>
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(onPrev || onNext) && (
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                  disabled={!onPrev}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  Prev
                </button>
                {currentIndex !== undefined && totalCount !== undefined && (
                  <span className="text-xs text-gray-400 min-w-[60px] text-center">
                    {currentIndex === -1 ? '★' : currentIndex + 1} / {totalCount}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                  disabled={!onNext}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                >
                  Next
                </button>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
