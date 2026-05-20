import type { Lang, ProviderId, ProviderInfo, TranslateRequest, TranslateResult } from "../types";

export interface TranslationProvider {
  info: ProviderInfo;
  supports(src: Lang, tgt: Lang): boolean;
  translate(req: TranslateRequest): Promise<TranslateResult>;
}

export type { ProviderId };
