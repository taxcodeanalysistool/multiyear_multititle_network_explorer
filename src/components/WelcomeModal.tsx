// src/components/WelcomeModal.tsx

import React from 'react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="p-8">
          <h2 className="text-3xl font-bold mb-6 text-white">
            Welcome to the U.S. Code Network Explorer
          </h2>

          <div className="space-y-5 text-gray-300">
            <p className="text-lg leading-relaxed">
              This tool allows you to explore relationships between sections of the United States Code,
              entities mentioned within them, and key concepts extracted from the legal text. Visualize
              how statutory provisions connect across different titles and over time.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-5">
                <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2 text-lg">
                  <span className="text-2xl">📚</span>
                  Multiple Titles & Time Periods
                </h3>
                <p className="text-sm text-gray-300">
                  Browse different USC titles (e.g., Title 26 - Internal Revenue Code, Title 11 - Bankruptcy)
                  and compare how the law evolved across different years or legislative periods.
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-600 rounded-lg p-5">
                <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2 text-lg">
                  <span className="text-2xl">🎨</span>
                  Understanding the Graph
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#9B96C9]"></span>
                    <span className="text-gray-300"><strong>Purple:</strong> USC Sections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#F0A734]"></span>
                    <span className="text-gray-300"><strong>Orange:</strong> Entities & Concepts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#AFBBE8]"></span>
                    <span className="text-gray-300"><strong>Blue:</strong> Other nodes</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                  <strong>Relationships:</strong> Definition (blue), Reference (green), Hierarchy (purple)
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-5">
              <h3 className="font-semibold text-blue-400 mb-4 flex items-center gap-2 text-lg">
                <span className="text-2xl">🔍</span>
                Two Ways to Explore
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="pl-4 border-l-2 border-blue-500">
                  <div className="font-medium text-white mb-2">Top-Down View</div>
                  <p className="text-sm text-gray-400">
                    Start with the full network and use filters to narrow down by relationship type,
                    node type, or keyword search. Great for browsing and discovering connections.
                  </p>
                </div>
                <div className="pl-4 border-l-2 border-green-500">
                  <div className="font-medium text-white mb-2">Bottom-Up Search</div>
                  <p className="text-sm text-gray-400">
                    Enter keywords to find matching nodes, then expand outward by degrees of connection.
                    Perfect for focused research on specific topics (e.g., "tax", "bankruptcy", "penalty").
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-600 rounded-lg p-5">
              <h3 className="font-semibold text-blue-400 mb-4 flex items-center gap-2 text-lg">
                <span className="text-2xl">🎯</span>
                Quick Start Guide
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">1.</span>
                  <span>
                    <strong>Select a title</strong> from the dropdown at the top of the left sidebar
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">2.</span>
                  <span>
                    <strong>Choose a time scope</strong> (year or period) in Graph Settings
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">3.</span>
                  <span>
                    <strong>Search for nodes</strong> or enter keywords to build a custom network
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold">4.</span>
                  <span>
                    <strong>Click any node</strong> to see its relationships in the right sidebar
                  </span>
                </div>
                <div className="flex items-start gap-2 md:col-span-2">
                  <span className="text-blue-400 font-bold">5.</span>
                  <span>
                    <strong>Export your work</strong> using the CSV or PNG export buttons to save subgraphs for analysis
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4 text-sm">
              <p className="text-yellow-200">
                <strong>Note:</strong> This visualization is derived from processed USC data and may not
                include all nuances of the full statutory text. Always refer to official sources for
                authoritative legal information.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg text-lg"
            >
              Start Exploring →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
