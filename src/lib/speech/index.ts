import { BrowserSpeechProvider } from "./BrowserSpeechProvider";
import { StubWhisperProvider } from "./StubWhisperProvider";
import type { SpeechProvider } from "./SpeechProvider";

export type { SpeechProvider } from "./SpeechProvider";

export function getDefaultSpeechProvider(): SpeechProvider {
  const browser = new BrowserSpeechProvider();
  if (browser.isSupported()) return browser;
  return new StubWhisperProvider();
}

export function listSpeechProviders(): SpeechProvider[] {
  return [new BrowserSpeechProvider(), new StubWhisperProvider()];
}
