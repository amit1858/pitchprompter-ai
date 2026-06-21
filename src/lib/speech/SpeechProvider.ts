// SpeechProvider interface so we can swap browser STT for whisper.cpp later
// without touching feature code.

export interface SpeechRecognitionResult {
  text: string;
  isFinal: boolean;
  timestamp: number;
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
