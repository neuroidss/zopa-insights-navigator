
import React from 'react';
import type { NegotiationDashboardData, NegotiationPartyInsight, NegotiationPartyPosition, NegotiationPartyInterest, NegotiationConstructiveStep, KeyTranscriptInsight } from '../types';

interface NegotiationDashboardDisplayProps {
  dashboardData: NegotiationDashboardData | null;
  nudgedItemIds: Set<string>;
  onNudgeItem: (itemId: string) => void;
}

const PartyInsightDisplay: React.FC<{ party: NegotiationPartyInsight; nudgedItemIds: Set<string>; onNudgeItem: (itemId: string) => void; parentPartyId: string }> = ({ party, nudgedItemIds, onNudgeItem, parentPartyId }) => {
    return (
      <div className={`mb-1.5 p-1.5 bg-white rounded shadow-sm`}> {/* Reduced mb, p */}
        <h4 className="text-xs font-semibold text-sky-700 mb-0.5 border-b pb-0.5">{party.id || 'Unnamed Party'}</h4> {/* text-xs, mb-0.5 */}
        {party.overallStance && <p className="text-xxs text-gray-600 mb-0.5 italic leading-tight"><strong>Stance:</strong> {party.overallStance}</p>} {/* text-xxs, mb-0.5, leading-tight */}
        
        {party.positions && party.positions.length > 0 && (
          <div className="mb-0.5"> {/* Reduced mb */}
            <h5 className="text-xxs font-medium text-gray-700">Identified Positions:</h5> {/* text-xxs */}
            <ul className="list-disc list-inside ml-2 text-xxs"> {/* Reduced ml, text-xxs */}
              {party.positions.map((pos: NegotiationPartyPosition) => (
                <li 
                    key={pos.id} 
                    className={`text-gray-600 leading-tight py-0 cursor-pointer hover:bg-sky-100 rounded px-0.5 ${nudgedItemIds.has(pos.id) ? 'bg-sky-200 ring-1 ring-sky-400' : ''}`} // py-0
                    onClick={() => onNudgeItem(pos.id)}
                    title={`Click to nudge: Position - ${pos.description}`}
                >
                    {pos.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        {party.interests && party.interests.length > 0 && (
          <div>
            <h5 className="text-xxs font-medium text-gray-700">Potential Interests:</h5> {/* text-xxs */}
            <ul className="list-disc list-inside ml-2 text-xxs"> {/* Reduced ml, text-xxs */}
              {party.interests.map((int: NegotiationPartyInterest) => (
                <li 
                    key={int.id} 
                    className={`text-gray-600 leading-tight py-0 cursor-pointer hover:bg-sky-100 rounded px-0.5 ${nudgedItemIds.has(int.id) ? 'bg-sky-200 ring-1 ring-sky-400' : ''}`} // py-0
                    onClick={() => onNudgeItem(int.id)}
                    title={`Click to nudge: Interest - ${int.description}`}
                >
                  {int.description}
                  {int.linkedPositionId && <span className="text-gray-400 text-xxs"> (re: P_ID {int.linkedPositionId.split('_').pop()})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
         {!party.positions?.length && !party.interests?.length && <p className="text-xxs text-gray-500 leading-tight">No specific positions or interests clearly identified for this party yet.</p>}
      </div>
    );
};

const NegotiationDashboardDisplay: React.FC<NegotiationDashboardDisplayProps> = ({ dashboardData, nudgedItemIds, onNudgeItem }) => {
  if (!dashboardData) {
    return (
        <div className="p-2 text-center text-gray-500 border border-sky-300 rounded-md bg-sky-50 flex-grow flex flex-col justify-center items-center"> {/* Reduced p */}
            <svg className="mx-auto h-6 w-6 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg> {/* Reduced icon size and mb */}
            <p className="text-xs">Waiting for negotiation data...</p> {/* text-xs */}
            <p className="text-xxs mt-0.5">Dashboard will update. Click items to highlight.</p> {/* text-xxs, mt-0.5, shorter text */}
        </div>
    );
  }

  const {
    overallSummary,
    parties,
    zopaAssessment,
    constructiveSteps,
    keyInsightsFromTranscript,
    detectedEmotionTone,
    lastUpdatedTimestamp
  } = dashboardData;

  return (
    <div className="p-1.5 bg-sky-100 rounded-md shadow-sm border border-sky-200 flex-grow overflow-y-auto text-xs"> {/* Reduced p, shadow-sm, text-xs globally */}
      <div className="mb-1.5"> {/* Reduced mb */}
        <h3 className="text-sm font-semibold text-sky-800 mb-0.5 border-b border-sky-300 pb-0.5">Overall Summary</h3> {/* text-sm, mb-0.5, pb-0.5 */}
        <p className="text-xxs text-gray-700 leading-snug">{overallSummary || "Awaiting summary..."}</p> {/* text-xxs */}
        {detectedEmotionTone && <p className="text-xxs text-gray-500 mt-0.5 leading-tight"><strong>Detected Tone:</strong> {detectedEmotionTone}</p>}
      </div>

      {parties && parties.length > 0 && (
        <div className="mb-1.5"> {/* Reduced mb */}
          <h3 className="text-sm font-semibold text-sky-800 mb-0.5 border-b border-sky-300 pb-0.5">Party Insights</h3> {/* text-sm, mb-0.5, pb-0.5 */}
          <div className="space-y-1 pr-0.5"> {/* Reduced space-y */}
            {parties.map((party, index) => (
              <PartyInsightDisplay 
                key={party.id || `party-${index}`} 
                party={party} 
                nudgedItemIds={nudgedItemIds} 
                onNudgeItem={onNudgeItem}
                parentPartyId={party.id || `party-${index}`}
              />
            ))}
          </div>
        </div>
      )}

      {zopaAssessment && (
        <div className="mb-1.5 p-1.5 bg-white rounded shadow-sm"> {/* Reduced mb, p */}
          <h3 className="text-sm font-semibold text-sky-800 mb-0.5">ZOPA Assessment</h3> {/* text-sm, mb-0.5 */}
          <p className="text-xxs text-gray-600 leading-tight"><strong>Likelihood:</strong> <span className={`font-medium ${
            zopaAssessment.likelihood === 'High' ? 'text-green-600' : 
            zopaAssessment.likelihood === 'Medium' ? 'text-yellow-600' :
            zopaAssessment.likelihood === 'Low' ? 'text-red-600' : 'text-gray-600'
          }`}>{zopaAssessment.likelihood || 'Not Assessed'}</span></p> {/* text-xxs, leading-tight */}
          {zopaAssessment.barriers?.length > 0 && <p className="text-xxs text-gray-600 mt-0.5 leading-tight"><strong>Barriers:</strong> {zopaAssessment.barriers.join(', ')}</p>}
          {zopaAssessment.potentialOverlap?.length > 0 && <p className="text-xxs text-gray-600 mt-0.5 leading-tight"><strong>Overlap:</strong> {zopaAssessment.potentialOverlap.join(', ')}</p>}
          {zopaAssessment.keyFactors?.length > 0 && <p className="text-xxs text-gray-600 mt-0.5 leading-tight"><strong>Key Factors:</strong> {zopaAssessment.keyFactors.join(', ')}</p>}
        </div>
      )}

      {keyInsightsFromTranscript && keyInsightsFromTranscript.length > 0 && (
        <div className="mb-1.5"> {/* Reduced mb */}
          <h3 className="text-sm font-semibold text-sky-800 mb-0.5 border-b border-sky-300 pb-0.5">Key Transcript Insights</h3> {/* text-sm, mb-0.5, pb-0.5 */}
          <ul className="list-disc list-inside ml-1 text-xxs"> {/* Reduced ml, text-xxs */}
            {keyInsightsFromTranscript.map((insight: KeyTranscriptInsight) => (
              <li 
                key={insight.id} 
                className={`text-gray-600 leading-tight py-0 cursor-pointer hover:bg-sky-100 rounded px-0.5 ${nudgedItemIds.has(insight.id) ? 'bg-sky-200 ring-1 ring-sky-400' : ''}`} // py-0
                onClick={() => onNudgeItem(insight.id)}
                title={`Click to nudge: Insight - ${insight.text}`}
              >
                {insight.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {constructiveSteps && constructiveSteps.length > 0 && (
        <div className="mb-1.5"> {/* Reduced mb */}
          <h3 className="text-sm font-semibold text-sky-800 mb-0.5 border-b border-sky-300 pb-0.5">Constructive Steps</h3> {/* text-sm, mb-0.5, pb-0.5 */}
          <ul className="list-disc list-inside ml-1 text-xxs"> {/* Reduced ml, text-xxs */}
            {constructiveSteps.map((step: NegotiationConstructiveStep) => (
              <li 
                key={step.id} 
                className={`text-gray-600 leading-tight py-0 cursor-pointer hover:bg-sky-100 rounded px-0.5 ${nudgedItemIds.has(step.id) ? 'bg-sky-200 ring-1 ring-sky-400' : ''}`} // py-0
                onClick={() => onNudgeItem(step.id)}
                title={`Click to nudge: Step - ${step.text}`}
              >
                <strong className="capitalize">[{step.type || 'Suggestion'}]</strong> {step.text}
                {step.targetParty && <span className="text-gray-400 text-xxs"> (for {step.targetParty})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <p className="text-xxs text-gray-400 text-right mt-1 pt-1 border-t border-sky-200"> {/* Reduced mt */}
        Dashboard last updated: {new Date(lastUpdatedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  );
};

export default NegotiationDashboardDisplay;
