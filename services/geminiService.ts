
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME } from '../constants';
import type { Source, GroundingChunk, GeminiResponse, NegotiationDashboardData } from '../types';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

const processJsonResponse = (response: GenerateContentResponse): GeminiResponse => {
  let rawText = response.text?.trim() || "";
  let jsonStrToParse = rawText;

  try {
    // Attempt to extract JSON from markdown code fence first
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStrToParse.match(fenceRegex);
    if (match && match[1]) {
      jsonStrToParse = match[1].trim();
    } else {
      // If no fence, try to find the outermost JSON structure.
      const firstBrace = jsonStrToParse.indexOf('{');
      const lastBrace = jsonStrToParse.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStrToParse = jsonStrToParse.substring(firstBrace, lastBrace + 1);
      } else {
        console.error("Response text does not appear to contain a valid JSON object structure.", "\nOriginal raw text:", rawText);
        return { error: `AI response did not contain a recognizable JSON structure. Response text (first 200 chars): ${rawText.substring(0,200)}` };
      }
    }
    
    const dashboardData: NegotiationDashboardData = JSON.parse(jsonStrToParse);
    
    if (!dashboardData.overallSummary || !dashboardData.parties || !dashboardData.zopaAssessment || !dashboardData.constructiveSteps || !dashboardData.keyInsightsFromTranscript) {
        console.error("Parsed JSON is missing core dashboard fields:", dashboardData, "\nCleaned JSON string (that was parsed):", jsonStrToParse.length > 1000 ? jsonStrToParse.substring(0,1000) + "..." : jsonStrToParse);
        return { error: "Received incomplete dashboard data from AI. Some key fields are missing." };
    }

    dashboardData.parties = dashboardData.parties?.map((party, pIdx) => ({
        ...party,
        id: party.id || `Party${pIdx + 1}`,
        positions: party.positions?.map((pos, posIdx) => ({
            ...pos,
            id: pos.id || `P_${party.id || `Party${pIdx + 1}`}_${posIdx + 1}`
        })) || [],
        interests: party.interests?.map((int, intIdx) => ({
            ...int,
            id: int.id || `I_${party.id || `Party${pIdx + 1}`}_${intIdx + 1}`
        })) || []
    })) || [];

    dashboardData.constructiveSteps = dashboardData.constructiveSteps?.map((step, idx) => ({
        ...step,
        id: step.id || `CS_${idx + 1}`
    })) || [];
    
    dashboardData.keyInsightsFromTranscript = dashboardData.keyInsightsFromTranscript?.map((kti, idx) => ({
        ...kti,
        id: kti.id || `KTI_${idx + 1}`
    })) || [];

    dashboardData.lastUpdatedTimestamp = new Date().toISOString(); 
    return { dashboardData };
  } catch (e) {
    let errorContext = "";
    if (e instanceof SyntaxError && (e as any).message) {
        const message = (e as any).message;
        const matchPos = message.match(/at position (\d+)/);
        if (matchPos && matchPos[1]) {
            const pos = parseInt(matchPos[1], 10);
            const contextRadius = 20;
            const start = Math.max(0, pos - contextRadius);
            const end = Math.min(jsonStrToParse.length, pos + contextRadius);
            const problematicSnippet = jsonStrToParse.substring(start, end);
            errorContext = `\nProblematic snippet (around char ${pos}): "...${problematicSnippet}..."`;
        }
    }
    const attemptedParseLog = jsonStrToParse.length > 2000 ? jsonStrToParse.substring(0, 2000) + "... (truncated)" : jsonStrToParse;
    console.error("Failed to parse JSON response from AI:", e, "\nAttempted to parse (cleaned):", attemptedParseLog, errorContext, "\nOriginal raw text:", rawText.length > 2000 ? rawText.substring(0,2000) + "... (truncated)" : rawText);
    return { error: `Failed to process structured data from AI. ${e instanceof Error ? e.message : 'Unknown parsing error.'}. Check console for the problematic text and snippet.` };
  }
};


const makeApiCallWithRetry = async (
  contents: string, 
  modelName: string
): Promise<GenerateContentResponse> => {
  if (!ai) {
    throw new Error("Gemini AI client is not initialized. Ensure API_KEY is set.");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          responseMimeType: "application/json",
        },
      });
      
      if (response.candidates && response.candidates.length > 0 && response.candidates[0].finishReason === 'SAFETY') {
        const safetyRatings = response.candidates[0].safetyRatings;
        const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
        const safetyErrorMsg = `Content generation blocked due to safety reasons. Categories: ${blockedCategories || 'Unknown'}.`;
        console.error(safetyErrorMsg, safetyRatings);
        throw new Error(safetyErrorMsg);
      }
      if (!response.text && !(response.candidates && response.candidates[0]?.content?.parts?.[0]?.text)) {
          let errorDetail = "No text content received from AI.";
          if (response.candidates && response.candidates.length > 0) {
              const candidate = response.candidates[0];
              if (candidate.finishReason && candidate.finishReason !== "STOP") {
                  errorDetail += ` Finish reason: ${candidate.finishReason}.`;
                  if (candidate.safetyRatings) {
                      errorDetail += ` Safety ratings: ${JSON.stringify(candidate.safetyRatings)}.`;
                  }
              }
          } else if (response.promptFeedback?.blockReason) {
             errorDetail += ` Prompt blocked. Reason: ${response.promptFeedback.blockReason}. Details: ${response.promptFeedback.blockReasonMessage || 'N/A'}`;
          }
          console.error(errorDetail, response);
          throw new Error(errorDetail);
      }

      return response;
    } catch (error) {
      console.error(`Gemini API call failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt === MAX_RETRIES) {
        if (error instanceof Error && error.message.includes("SAFETY")) {
             throw error; 
        }
        throw new Error(`Failed to fetch data after ${MAX_RETRIES} retries. Last error: ${error instanceof Error ? error.message : String(error)}`);
      }
      await new Promise(resolve => setTimeout(resolve, INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("Failed to fetch data after multiple retries (exhausted loop)."); 
};

const getDashboardSystemPrompt = () => {
  return `Your role is to act as an AI negotiation assistant. You will receive a transcript of an ongoing negotiation.
The transcript might be preceded by a section titled "OBSERVER-HIGHLIGHTED INSIGHTS FROM PREVIOUS ANALYSIS". If this section exists, pay special attention to these highlighted points. Consider their current relevance, how they connect to new information in the transcript, and if they warrant further elaboration or modification in your new analysis. However, your primary task is always to analyze the *entire current negotiation transcript* provided after this optional preamble.

CRITICAL: Your entire response MUST be a single, valid JSON object. Do not include any text, markdown, or explanations before or after the JSON.
The JSON object must conform to the following TypeScript interface structure for "NegotiationDashboardData":

interface NegotiationPartyPosition {
  id: string; // Generate a unique ID, e.g., "P_PartyA_1", "P_PartyB_1"
  description: string;
}

interface NegotiationPartyInterest {
  id: string; // Generate a unique ID, e.g., "I_PartyA_1", "I_PartyB_1"
  linkedPositionId?: string; // Optional: ID of the position this interest relates to
  description: string;
}

interface NegotiationPartyInsight {
  id: string; // "Party A", "Party B", or inferred role like "Speaker 1". Be consistent.
  positions: NegotiationPartyPosition[];
  interests: NegotiationPartyInterest[];
  overallStance?: string; // Brief 1-2 sentence summary.
}

interface NegotiationZopaAssessment {
  likelihood: 'Low' | 'Medium' | 'High' | 'Uncertain' | 'Not Assessed';
  barriers: string[];
  potentialOverlap: string[];
  keyFactors: string[];
}

interface NegotiationConstructiveStep {
  id: string; // Generate a unique ID, e.g., "CS_1", "CS_2"
  type: 'suggestion' | 'question' | 'clarification_needed';
  text: string;
  targetParty?: string; // Optional: ID of the party this step is primarily for.
}

interface KeyTranscriptInsight {
  id: string; // Generate a unique ID, e.g., "KTI_1", "KTI_2"
  text: string; // The key insight text.
}

interface NegotiationDashboardData {
  overallSummary: string; // Brief 2-3 sentence executive summary.
  parties: NegotiationPartyInsight[]; // Array of insights for each distinct party.
  zopaAssessment: NegotiationZopaAssessment;
  constructiveSteps: NegotiationConstructiveStep[]; // 2-4 actionable suggestions.
  keyInsightsFromTranscript: KeyTranscriptInsight[]; // 3-5 key facts/statements from transcript.
  detectedEmotionTone?: 'Neutral' | 'Tense' | 'Collaborative' | 'Conflictual' | 'Anxious' | 'Frustrated' | 'Positive' | 'Mixed';
  lastUpdatedTimestamp: string; // Placeholder (e.g., new Date().toISOString()), client will overwrite.
}

Instructions for populating the JSON:
- Generate unique, consistent IDs for all items that need them (positions, interests, steps, key insights). Example: "P_PartyA_1", "I_PartyA_1", "CS_1", "KTI_1".
- Analyze the full transcript, considering any observer-highlighted insights if provided.
- Be concise. Descriptions brief but informative.
- If hard to distinguish parties, use generic IDs like "Speaker 1", "Speaker 2". If only one main speaker is evident, label them clearly and perhaps include a placeholder for "Other Party (Implicit/Silent)" if their perspective is being inferred or absent.
- 'keyInsightsFromTranscript' should be impactful pieces of information. Ensure each is an object with 'id' and 'text'.
- Ensure all string fields are properly escaped for JSON. All string values must be valid UTF-8 and MUST NOT contain any unescaped control characters, malformed byte sequences, or any other non-textual data that would break JSON parsing.
- If info is indeterminable, use empty arrays or defaults like "Not Assessed", but maintain valid JSON structure.
- Aim for at least two parties if discernible.

Your response MUST start with "{" and end with "}". No other text whatsoever.
`;
};


export const analyzeInterestsFromPosition = async (transcriptWithPreamble: string): Promise<GeminiResponse> => {
  if (!API_KEY) return { error: "API Key is not configured." };
  if (!ai) return { error: "Gemini AI client is not initialized. API Key might be missing or invalid." };

  const fullPrompt = `${getDashboardSystemPrompt()}\n\nUSER_PROVIDED_CONTENT_START\n${transcriptWithPreamble}\nUSER_PROVIDED_CONTENT_END`;

  try {
    const response = await makeApiCallWithRetry(fullPrompt, GEMINI_MODEL_NAME);
    return processJsonResponse(response);
  } catch (error) {
    console.error("Error in analyzeInterestsFromPosition:", error);
    if (error instanceof Error) {
      if (error.message.includes('API key not valid') || error.message.includes('permission denied')) {
         return { error: "API Key is not valid or has insufficient permissions. Please check your configuration." };
      }
      if (error.message.includes('Content generation blocked due to safety reasons')) {
        return { error: error.message };
      }
      return { error: `An error occurred while analyzing: ${error.message}` };
    }
    return { error: "An unknown error occurred while analyzing." };
  }
};
