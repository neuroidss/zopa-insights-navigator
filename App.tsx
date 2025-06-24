

import React, { useState, useEffect, useCallback, useRef } from 'react';
// import SearchInput from './components/SearchInput'; // No longer used
// import ResultsDisplay from './components/ResultsDisplay'; // No longer used
import LoadingSpinner from './components/LoadingSpinner';
import ErrorAlert from './components/ErrorAlert';
// import PositionInput from './components/PositionInput'; // No longer used
// import InterestsDisplay from './components/InterestsDisplay'; // No longer used
import NegotiationDashboardDisplay from './components/NegotiationDashboardDisplay';
import { analyzeInterestsFromPosition } from './services/geminiService'; // fetchZOPAInfo no longer used
import type { GeminiResponse, NegotiationDashboardData } from './types';
import { APP_TITLE } from './constants';

// Web Speech API interfaces (remains the same)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}
interface SpeechRecognition extends EventTarget {
  grammars: any;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

const SpeechRecognitionAPI: SpeechRecognitionStatic | undefined =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const DASHBOARD_UPDATE_INTERVAL = 30000; 
const MIN_TRANSCRIPT_LENGTH_FOR_UPDATE = 50;
const SPEECH_RESTART_DELAY = 250; // ms

const App: React.FC = () => {
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(false);
  const [speechApiError, setSpeechApiError] = useState<string | null>(null);

  const sessionRecognitionRef = useRef<SpeechRecognition | null>(null);
  const userManuallyStoppedSessionRef = useRef<boolean>(true); 
  const [isSessionListening, setIsSessionListening] = useState<boolean>(false);
  const [sessionTranscript, setSessionTranscript] = useState<string>("");
  const [isLoadingDashboardUpdate, setIsLoadingDashboardUpdate] = useState<boolean>(false);
  const [negotiationDashboardContent, setNegotiationDashboardContent] = useState<NegotiationDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const liveTranscriptAreaRef = useRef<HTMLDivElement>(null);
  const dashboardUpdateTimerRef = useRef<number | null>(null);
  const lastAnalyzedTranscriptLengthRef = useRef<number>(0);
  
  const [nudgedItemIds, setNudgedItemIds] = useState<Set<string>>(new Set());

  // Diagnostic log for sessionTranscript
  // console.log('[App Render] sessionTranscript (first 100 chars):', sessionTranscript.substring(0,100));


  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
      const errorMsg = "CRITICAL: API Key is missing. Please ensure the API_KEY environment variable is set.";
      setDashboardError(errorMsg);
    }
    if (!SpeechRecognitionAPI) {
      setSpeechApiError("Speech recognition is not supported by your browser. The live session features may not work.");
      userManuallyStoppedSessionRef.current = true; 
    }
  }, []);
  
  useEffect(() => {
    if (liveTranscriptAreaRef.current) {
      liveTranscriptAreaRef.current.scrollTop = liveTranscriptAreaRef.current.scrollHeight;
    }
  }, [sessionTranscript]);

  const handleDashboardItemNudge = (itemId: string) => {
    setNudgedItemIds(prevNudgedIds => {
      const newNudgedIds = new Set(prevNudgedIds);
      if (newNudgedIds.has(itemId)) {
        newNudgedIds.delete(itemId);
      } else {
        newNudgedIds.add(itemId);
      }
      return newNudgedIds;
    });
    fetchDashboardUpdate(true); 
  };
  
  const getNudgedItemsDescriptions = (): string[] => {
    if (!negotiationDashboardContent || nudgedItemIds.size === 0) return [];
    
    const descriptions: string[] = [];
    nudgedItemIds.forEach(id => {
      negotiationDashboardContent.parties.forEach(party => {
        party.positions.forEach(pos => {
          if (pos.id === id) descriptions.push(`Position (${party.id}): ${pos.description}`);
        });
        party.interests.forEach(int => {
          if (int.id === id) descriptions.push(`Interest (${party.id}): ${int.description}`);
        });
      });
      negotiationDashboardContent.constructiveSteps.forEach(step => {
        if (step.id === id) descriptions.push(`Constructive Step: ${step.text}`);
      });
      negotiationDashboardContent.keyInsightsFromTranscript.forEach(kti => {
        if (kti.id === id) descriptions.push(`Key Transcript Insight: ${kti.text}`);
      });
    });
    return descriptions;
  };

  const fetchDashboardUpdate = useCallback(async (forceUpdate: boolean = false) => {
    if (apiKeyMissing || !sessionTranscript.trim()) {
      return;
    }
    if (!forceUpdate && sessionTranscript.length < lastAnalyzedTranscriptLengthRef.current + MIN_TRANSCRIPT_LENGTH_FOR_UPDATE) {
      return;
    }
    if (isLoadingDashboardUpdate && !forceUpdate) return;

    console.log("Requesting dashboard update from AI...");
    setIsLoadingDashboardUpdate(true);
    setDashboardError(null);
    if(forceUpdate || !dashboardUpdateTimerRef.current){ 
        lastAnalyzedTranscriptLengthRef.current = sessionTranscript.length;
    }

    let transcriptWithNudges = sessionTranscript;
    const nudgedDescriptions = getNudgedItemsDescriptions();
    if (nudgedDescriptions.length > 0) {
      const nudgePreamble = `OBSERVER-HIGHLIGHTED INSIGHTS FROM PREVIOUS ANALYSIS (Consider these in your current analysis):\n${nudgedDescriptions.map(d => `- ${d}`).join('\n')}\n\nCURRENT NEGOTIATION TRANSCRIPT:\n`;
      transcriptWithNudges = nudgePreamble + sessionTranscript;
    }
    
    console.log("Transcript being sent to AI (first 500 chars):", transcriptWithNudges.substring(0, 500));
    if (transcriptWithNudges.length > 500) {
      console.log("Full transcript length:", transcriptWithNudges.length);
    }


    try {
      const result = await analyzeInterestsFromPosition(transcriptWithNudges); 
      if (result.error) {
        setDashboardError(result.error);
      } else if (result.dashboardData) {
        setNegotiationDashboardContent(result.dashboardData);
      } else {
        setDashboardError("Received unexpected data structure for dashboard.");
      }
    } catch (e) {
      setDashboardError(e instanceof Error ? e.message : "An unexpected error occurred during dashboard update.");
    } finally {
      setIsLoadingDashboardUpdate(false);
    }
  }, [apiKeyMissing, sessionTranscript, isLoadingDashboardUpdate, nudgedItemIds, negotiationDashboardContent]); 

  useEffect(() => {
    if (isSessionListening && sessionTranscript.trim()) {
      if (dashboardUpdateTimerRef.current) {
        clearTimeout(dashboardUpdateTimerRef.current);
      }
      dashboardUpdateTimerRef.current = window.setTimeout(() => {
        fetchDashboardUpdate();
      }, DASHBOARD_UPDATE_INTERVAL);
    } else if (!isSessionListening && dashboardUpdateTimerRef.current) {
      clearTimeout(dashboardUpdateTimerRef.current);
      dashboardUpdateTimerRef.current = null;
    }
    return () => {
      if (dashboardUpdateTimerRef.current) {
        clearTimeout(dashboardUpdateTimerRef.current);
      }
    };
  }, [sessionTranscript, isSessionListening, fetchDashboardUpdate]);

  const setupRecognitionInstance = (
    onResultCallback: (event: SpeechRecognitionEvent) => void
  ): SpeechRecognition | null => {
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU'; 

    recognition.onstart = () => {
      console.log("Speech recognition started successfully.");
      setIsSessionListening(true);
      setSpeechApiError(null); 
    };

    recognition.onresult = onResultCallback;
    
    recognition.onerror = (event: any) => {
      const errorEvent = event as { error: string; message?: string }; // Common structure for SpeechRecognitionErrorEvent
      console.error(`Session speech error: ${errorEvent.error}`, errorEvent.message ? `Message: ${errorEvent.message}` : '');
      const errorType = errorEvent.error;

      if (userManuallyStoppedSessionRef.current) {
        if (errorType === 'aborted') {
          console.log("Speech recognition 'aborted' event received, consistent with session being manually stopped or a prior critical error. No new user-facing error.");
        } else {
           console.warn(`Speech error '${errorType}' occurred while session was already stopping/stopped.`);
        }
        setIsSessionListening(false); 
        return; 
      }
      
      const isStandardRecoverableError = 
        (errorType === 'no-speech') ||
        (errorType === 'network') ||
        (errorType === 'audio-capture');

      const isExternallyAbortedAndRecoverable = 
        (errorType === 'aborted'); 

      if (isStandardRecoverableError || isExternallyAbortedAndRecoverable) {
        console.log(`Speech error '${errorType}' occurred; will attempt recovery via onend handler as session was intended to be active.`);
      } else {
        let errorMessage = `Live session speech error: ${errorType}. Session stopped.`;
        if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
          errorMessage += " Please check microphone permissions, browser settings, or network connection.";
        } else {
          errorMessage += " Please try starting the session again.";
        }
        setSpeechApiError(errorMessage);
        userManuallyStoppedSessionRef.current = true; 
        setIsSessionListening(false); 
      }
    };

    recognition.onend = () => {
      console.log("Speech recognition service instance stopped (onend).");
      if (!userManuallyStoppedSessionRef.current) {
        console.log("Attempting to restart speech recognition (onend) due to automatic continuation policy...");
        setTimeout(() => {
          if (!userManuallyStoppedSessionRef.current && sessionRecognitionRef.current) {
            try {
              sessionRecognitionRef.current.start();
              console.log("Speech recognition restart re-initiated by onend.");
            } catch (e) {
              const restartError = e instanceof Error ? e.message : String(e);
              console.error("Error synchronously restarting speech recognition from onend:", restartError);
              setSpeechApiError(`Failed to automatically restart live session: ${restartError}. Please try starting it manually.`);
              userManuallyStoppedSessionRef.current = true; 
              setIsSessionListening(false); 
            }
          } else {
             if (userManuallyStoppedSessionRef.current) {
                console.log("Restart via onend aborted: User manually stopped session or critical error occurred before restart timeout.");
             } else if (!sessionRecognitionRef.current) {
                console.log("Restart via onend aborted: Recognition ref is null.");
             }
             setIsSessionListening(false); 
          }
        }, SPEECH_RESTART_DELAY);
      } else {
        console.log("Session was manually stopped or a critical error occurred (onend). Not restarting. Ensuring session is marked as not listening.");
        setIsSessionListening(false);
      }
    };
    
    return recognition;
  };

  const toggleSessionListening = () => {
    if (!SpeechRecognitionAPI) {
      setSpeechApiError("Speech recognition is not available for live session.");
      return;
    }

    if (isSessionListening) { 
      console.log("User manually stopping session listening.");
      userManuallyStoppedSessionRef.current = true; 
      sessionRecognitionRef.current?.stop(); 
      if (dashboardUpdateTimerRef.current) clearTimeout(dashboardUpdateTimerRef.current);
      if(sessionTranscript.trim()){ 
         fetchDashboardUpdate(true);
      }
    } else { 
      console.log("User manually starting session listening.");
      userManuallyStoppedSessionRef.current = false; 
      
      setSessionTranscript(""); 
      setNegotiationDashboardContent(null);
      setDashboardError(null);
      setSpeechApiError(null); 
      setNudgedItemIds(new Set()); 
      lastAnalyzedTranscriptLengthRef.current = 0;

      if (!sessionRecognitionRef.current) { 
        sessionRecognitionRef.current = setupRecognitionInstance(
          (event: SpeechRecognitionEvent) => { 
            let finalSegmentThisResult = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcriptPart = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalSegmentThisResult += transcriptPart + (transcriptPart.endsWith('.') || transcriptPart.endsWith('?') || transcriptPart.endsWith('!') || transcriptPart.length > 30 ? '\n' : ' ');
              }
            }
            if (finalSegmentThisResult) {
              setSessionTranscript(prev => prev + finalSegmentThisResult);
            }
          }
        );
      }
      
      if (sessionRecognitionRef.current) {
        try {
          sessionRecognitionRef.current.start();
        } catch (e) {
          const startError = e instanceof Error ? e.message : String(e);
          console.error("Error starting speech recognition instance:", startError);
          setSpeechApiError(`Failed to start live session: ${startError}. Please check microphone permissions or browser settings.`);
          userManuallyStoppedSessionRef.current = true; 
          setIsSessionListening(false); 
        }
      } else {
         setSpeechApiError("Could not initialize speech recognition for live session. Browser might not support it or an issue occurred.");
         userManuallyStoppedSessionRef.current = true; 
         setIsSessionListening(false); 
      }
    }
  };

  const contentAreaMinHeight = "calc(100vh - 9rem)"; // Adjusted for potentially slightly slimmer header/footer total

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-slate-800 text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5"> {/* Slightly reduced py */}
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-center">{APP_TITLE}</h1>
          <p className="text-center text-slate-300 mt-0.5 text-xs md:text-sm">Live Negotiation Assistant (Voice-Powered Dashboard)</p> {/* Reduced mt and font size */}
        </div>
      </header>

      <main className="container mx-auto px-2 py-3 md:px-4 md:py-4 lg:px-6 lg:py-5 flex-grow flex flex-col" style={{minHeight: contentAreaMinHeight}}> {/* Reduced padding */}
        {apiKeyMissing && <ErrorAlert message="CRITICAL: API Key is missing. Please ensure the API_KEY environment variable is set." />}
        {speechApiError && <ErrorAlert message={speechApiError} />}
        
        <section aria-labelledby="live-session-title" className="p-2 md:p-3 bg-sky-50 shadow-xl rounded-lg flex flex-col flex-grow"> {/* Reduced padding */}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-2.5"> {/* Reduced mb */}
            <h2 id="live-session-title" className="text-lg md:text-xl font-semibold text-sky-700"> {/* Reduced font size */}
              Negotiation Analysis
            </h2>
            {!apiKeyMissing && SpeechRecognitionAPI && (
              <button
                type="button"
                onClick={toggleSessionListening}
                disabled={!SpeechRecognitionAPI || apiKeyMissing} 
                className={`w-full mt-2 sm:mt-0 sm:w-auto px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition duration-150 ease-in-out  /* Reduced padding and font */
                            ${isSessionListening ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                            ${(!SpeechRecognitionAPI || apiKeyMissing) ? 'opacity-50 cursor-not-allowed' : ''}
                            focus:outline-none focus:ring-2 focus:ring-offset-2 ${isSessionListening ? 'focus:ring-red-500' : 'focus:ring-green-500'}`}
              >
                {isSessionListening ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-pulse h-4 w-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"></path></svg> {/* Reduced icon size */}
                    Stop Live Session
                  </div>
                ): 'Start Live Session'}
              </button>
            )}
          </div>
           {!SpeechRecognitionAPI && <p className="text-xs text-yellow-700 mb-2.5">Live session features require browser support for Speech Recognition.</p>}
           {apiKeyMissing && <p className="text-xs text-red-700 mb-2.5">Live session features require a valid API Key.</p>}


          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 mt-2 flex-grow"> {/* Reduced gap and mt */}
            <div className="flex flex-col"> 
              <h3 className="text-base font-medium text-sky-600 mb-1">Live Transcript</h3> {/* Reduced font size and mb */}
              <div 
                ref={liveTranscriptAreaRef}
                id="live-transcript" 
                aria-live="polite"
                className="w-full flex-grow p-2 border border-sky-300 rounded-md bg-white overflow-y-auto text-gray-800 text-sm min-h-[150px] whitespace-pre-wrap"
              >
                {sessionTranscript || <span className="text-gray-400">Negotiation transcript will appear here when live session starts...</span>}
              </div>
            </div>
            <div className="flex flex-col mt-2 md:mt-0"> {/* Reduced mt */}
              <h3 className="text-base font-medium text-sky-600 mb-1">Negotiation Dashboard (Interactive)</h3> {/* Reduced font size and mb */}
              <div className="flex-grow flex flex-col min-h-[150px]"> {/* Ensure this container can grow */}
                {isLoadingDashboardUpdate && <div className="flex-grow flex items-center justify-center bg-white border border-sky-300 rounded-md"><LoadingSpinner /></div>}
                {!isLoadingDashboardUpdate && dashboardError && !apiKeyMissing && <div className="flex-grow p-2 border border-sky-300 rounded-md bg-white overflow-y-auto"><ErrorAlert message={dashboardError} /></div>}
                {!isLoadingDashboardUpdate && !dashboardError && (negotiationDashboardContent || isSessionListening || (!userManuallyStoppedSessionRef.current && sessionTranscript)) && ( 
                  <NegotiationDashboardDisplay 
                    dashboardData={negotiationDashboardContent}
                    nudgedItemIds={nudgedItemIds}
                    onNudgeItem={handleDashboardItemNudge} 
                  />
                )}
                {!isLoadingDashboardUpdate && !dashboardError && !negotiationDashboardContent && (!isSessionListening && userManuallyStoppedSessionRef.current) && (
                  <div className="text-center p-4 bg-white flex-grow flex flex-col justify-center items-center border border-sky-300 rounded-md"> {/* Reduced padding */}
                    <svg className="mx-auto h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"> {/* Reduced icon size */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                    </svg>
                    <h4 className="mt-1 text-sm font-medium text-gray-900">Dashboard Insights</h4> {/* Reduced font size and mt */}
                    <p className="mt-0.5 text-xs text-gray-500"> {/* Reduced mt */}
                      Start a live session. The AI will periodically analyze the transcript and display insights here. Click on insights to highlight them for the AI.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-700 text-slate-300 text-center p-2 text-xxs fixed bottom-0 w-full"> {/* Reduced padding, text-xxs */}
        <p>&copy; {new Date().getFullYear()} {APP_TITLE}. Powered by Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;
