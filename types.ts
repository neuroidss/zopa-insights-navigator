export interface Source {
  uri: string;
  title: string;
}

export interface WebSource {
  uri?: string; // Made optional to match @google/genai's GroundingChunkWeb
  title?: string; // Made optional as titles can also be missing from source
}

export interface RetrievedContextSource {
  uri?: string; // Made optional
  title?: string; // Made optional
}

// This mirrors the structure from @google/genai's GroundingChunk
export interface GroundingChunk {
  web?: WebSource;
  retrievedContext?: RetrievedContextSource;
  // Other potential fields from GroundingChunk if needed, but web/retrievedContext are primary for sources
}

// --- Updated types for Structured Dashboard Data ---
export interface NegotiationPartyPosition {
  id: string; // e.g., "P_PartyA_1", "P_PartyB_1" (unique across all positions)
  description: string;
  isNudged?: boolean; // For UI indication
}

export interface NegotiationPartyInterest {
  id: string; // e.g., "I_PartyA_1", "I_PartyB_1" (unique across all interests)
  linkedPositionId?: string; // Connects interest to a specific position
  description: string;
  isNudged?: boolean; // For UI indication
}

export interface NegotiationPartyInsight {
  id: string; // e.g., "Party A", "Speaker 1", or inferred name/role
  positions: NegotiationPartyPosition[];
  interests: NegotiationPartyInterest[];
  overallStance?: string; // Brief summary of their apparent stance
}

export interface NegotiationZopaAssessment {
  likelihood: 'Low' | 'Medium' | 'High' | 'Uncertain' | 'Not Assessed' | string; // Allow string for AI flexibility
  barriers: string[];
  potentialOverlap: string[];
  keyFactors: string[]; // e.g., factors influencing ZOPA
}

export interface NegotiationConstructiveStep {
  id: string; // e.g., "CS_1", "CS_2" (unique across all steps)
  type: 'suggestion' | 'question' | 'clarification_needed' | string; // Allow string
  text: string;
  targetParty?: string; // Optional: who this step is for
  isNudged?: boolean; // For UI indication
}

export interface KeyTranscriptInsight {
  id: string; // e.g., "KTI_1", "KTI_2" (unique across all key insights)
  text: string;
  isNudged?: boolean; // For UI indication
}

export interface NegotiationDashboardData {
  overallSummary: string;
  parties: NegotiationPartyInsight[];
  zopaAssessment: NegotiationZopaAssessment;
  constructiveSteps: NegotiationConstructiveStep[];
  keyInsightsFromTranscript: KeyTranscriptInsight[]; // Changed to array of objects
  detectedEmotionTone?: 'Neutral' | 'Tense' | 'Collaborative' | 'Conflictual' | 'Anxious' | 'Frustrated' | 'Positive' | 'Mixed' | string; // AI's assessment of overall tone
  lastUpdatedTimestamp: string; // ISO string for when the analysis was "finalized"
}

export interface GeminiResponse {
  text?: string; // For markdown-based responses from ZOPA/Position Analyzer
  sources?: Source[];
  dashboardData?: NegotiationDashboardData; // For structured JSON dashboard from Live Session
  error?: string;
}