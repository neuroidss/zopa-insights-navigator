import React from 'react';
import type { Source } from '../types';

interface ResultsDisplayProps {
  responseText?: string;
  sources?: Source[];
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ responseText, sources }) => {
  if (!responseText && (!sources || sources.length === 0)) {
    return null; 
  }

  const formatText = (text: string) => {
    // Basic formatting: replace newlines with <br />, bold markdown-like headings.
    // This is a simplified markdown-to-HTML. For complex markdown, a library would be better.
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-3 mb-1 text-gray-800">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold mt-4 mb-2 text-gray-800">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-semibold mt-5 mb-3 text-gray-800">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italics
      .replace(/\n/g, '<br />');
  };
  

  return (
    <div className="bg-white shadow-xl rounded-lg p-6 my-6">
      {responseText && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">AI Insights on ZOPA</h2>
          <div 
            className="prose prose-lg max-w-none text-gray-700 leading-relaxed" 
            dangerouslySetInnerHTML={{ __html: formatText(responseText) }} 
          />
        </div>
      )}

      {sources && sources.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">Sources</h3>
          <ul className="list-disc list-inside space-y-2">
            {sources.map((source, index) => (
              <li key={index} className="text-gray-600">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline transition duration-150 ease-in-out break-all"
                  title={source.title || source.uri}
                >
                  {source.title || source.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;
