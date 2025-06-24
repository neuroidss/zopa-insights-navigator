import React from 'react';

interface PositionInputProps {
  onSubmit: (positionQuery: string) => void;
  isLoading: boolean;
  query: string;
  onQueryChange: (newQuery: string) => void;
  isListening: boolean;
  onToggleListening: () => void;
  speechSupported: boolean;
}

const PositionInput: React.FC<PositionInputProps> = ({
  onSubmit,
  isLoading,
  query,
  onQueryChange,
  isListening,
  onToggleListening,
  speechSupported,
}) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-6 bg-white shadow-lg rounded-lg">
      <label htmlFor="positionQuery" className="block text-lg font-semibold text-gray-700 mb-2">
        Describe the Negotiating Position(s)
      </label>
      <div className="relative">
        <textarea
          id="positionQuery"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="e.g., 'The supplier insists on a 1-year contract minimum.' Click the mic or type here."
          className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition duration-150 ease-in-out resize-none h-32 text-gray-700"
          rows={4}
          disabled={isLoading || isListening}
          aria-label="Describe negotiating position"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={onToggleListening}
            disabled={isLoading}
            className={`absolute top-3 right-3 p-2 rounded-full transition-colors duration-150 ease-in-out
                        ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'}
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-purple-500`}
            aria-label={isListening ? 'Stop listening' : 'Start listening to describe position'}
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              {isListening ? (
                 <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              ) : (
                <path d="M7 4a3 3 0 016 0v4a3 3 0 01-6 0V4zm0 2a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1zm7 0a1 1 0 00-1 1v2a1 1 0 102 0V7a1 1 0 00-1-1zM4 9a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm11 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM7 12a4 4 0 00-4 4H2a1 1 0 100 2h16a1 1 0 100-2h-1a4 4 0 00-4-4h-6z" />
              )}
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading || !query.trim() || isListening}
        className={`mt-4 w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white transition duration-150 ease-in-out ${
          isLoading || !query.trim() || isListening
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
        }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing...
          </>
        ) : (
          'Analyze Interests'
        )}
      </button>
       {!speechSupported && (
         <p className="text-xs text-yellow-600 mt-2">Voice input not supported by your browser. Please type your query.</p>
      )}
    </form>
  );
};

export default PositionInput;
