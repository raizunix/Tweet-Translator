export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslationResult {
  text: string;
  detectedLanguage?: string;
}

export interface TranslationProvider {
  translate(request: TranslationRequest, signal: AbortSignal): Promise<TranslationResult>;
}
