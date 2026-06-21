// SpeechProvider interface so we can swap browser STT for whisper.cpp later
// without touching feature code.

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
  timestamp: number;
  /** Web Speech results index (0..N). Optional for non-Web-Speech providers. */
  resultIndex?: number;
  /** Full accumulated transcript for that resultIndex, pre-delta. Optional, debug-only. */
  rawTranscript?: string;
}

export type SpeechResultHandler = (r: SpeechRecognitionResult) => void;
export type SpeechErrorHandler = (e: { code: string; message: string }) => void;

export interface SpeechProvider {
  readonly id: string;
  readonly displayName: string;
  isSupported(): boolean;
  start(opts: {
    lang?: string;
    onResult: SpeechResultHandler;
    onError?: SpeechErrorHandler;
    onEnd?: () => void;
  }): Promise<void>;
  stop(): void;
}
