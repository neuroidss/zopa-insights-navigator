import React from 'react';
import type { Source } from '../types';

interface InterestsDisplayProps {
  responseText?: string;
  sources?: Source[];
}

const InterestsDisplay: React.FC<InterestsDisplayProps> = ({ responseText, sources }) => {
  if (!responseText && (!sources || sources.length === 0)) {
    return null; 
  }

  // Improved formatting for potential interests, especially markdown lists
  const formatInterestsText = (text: string) => {
    let html = text;

    // Headings (less likely in direct interest lists, but for completeness)
    html = html.replace(/^### (.*$)/gim, '<h4 class="text-lg font-semibold mt-2 mb-1 text-gray-800">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="text-xl font-semibold mt-3 mb-1 text-gray-800">$1</h3>');
    
    // Bold and Italics
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert markdown-style bullet points (*, -, +) to HTML lists
    // Handle lists that might be separated by double newlines
    const listSections = html.split(/\n\s*\n/); // Split by one or more empty lines
    html = listSections.map(section => {
      if (section.match(/^(\s*(\*|-|\+)\s.*)(\n\s*(\*|-|\+)\s.*)*/s)) { // Check if section looks like a list
        let listHtml = '<ul>';
        section.split('\n').forEach(line => {
          const match = line.match(/^\s*(\*|-|\+)\s(.*)/);
          if (match) {
            listHtml += `<li class="ml-4 py-1 text-gray-700 leading-relaxed">${match[2].trim()}</li>`;
          } else if (listHtml !== '<ul>' && line.trim() !== '') { 
            // If it's not a list item but we're in a list block, append as paragraph (or handle as needed)
            // This case might need refinement based on actual AI output variations
            listHtml += `<p class="mt-1 mb-1 text-gray-700 leading-relaxed">${line.trim()}</p>`;
          } else if (line.trim() !== '') {
             // Non-list line outside a list block
             return `<p class="my-2 text-gray-700 leading-relaxed">${line.trim()}</p>`
          }
        });
        listHtml += '</ul>';
        return listHtml;
      }
      return section.replace(/\n/g, '<br />'); // For non-list sections or lines
    }).join('<br /><br />'); // Re-join sections with paragraph breaks

    // Final pass for any remaining single newlines if not handled by list logic
    // html = html.replace(/(?<!<br\s*\/?>)\n/g, '<br />');

    return html;
  };
  
  return (
    <div className="bg-white shadow-xl rounded-lg p-6 my-6">
      {responseText && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Potential Underlying Interests</h2>
          <div 
            className="prose prose-lg max-w-none" // Tailwind prose might handle some styling
            dangerouslySetInnerHTML={{ __html: formatInterestsText(responseText) }} 
          />
        </div>
      )}

      {sources && sources.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b pb-2">Relevant Sources</h3>
          <ul className="list-disc list-inside space-y-2">
            {sources.map((source, index) => (
              <li key={index} className="text-gray-600">
                <a
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-800 hover:underline transition duration-150 ease-in-out break-all"
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

export default InterestsDisplay;
