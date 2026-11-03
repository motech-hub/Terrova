export type GenerationStatus =
  | "pending"
  | "analyzing"
  | "generating"
  | "processing"
  | "completed"
  | "failed";

export type VideoStyle = "elegant" | "dynamic" | "cinematic" | "minimal";
export type VideoRatio = "9:16" | "16:9" | "1:1";
export type VideoDuration = 5 | 10 | 15;

export type GenerateVideoInput = {
  sessionId: string;
  images: Array<{ key: string; url?: string }>;
  property: {
    type: string;
    transaction: string;
    district?: string;
    comments?: string;
  };
  video: {
    style: VideoStyle;
    ratio: VideoRatio;
    duration: VideoDuration;
    platform?: string;
    prompt?: string;
    templateInstructions?: string;
  };
};

export type GenerationJob = {
  jobId: string;
  status: GenerationStatus;
  provider: "make" | "openrouter" | "demo";
  providerStatusUrl?: string;
  creditCost?: number;
  creditReservationId?: string;
};

export type GenerationEstimate = {
  provider: "openrouter" | "demo";
  providerCostUsd?: number;
  terrovaCredits?: number;
};

export type GenerationResult = GenerationJob & {
  videoUrl?: string;
  /** En-têtes internes utilisés uniquement pour rapatrier une sortie provider protégée. */
  videoDownloadHeaders?: Record<string, string>;
  message?: string;
};

export interface VideoGenerationProvider {
  generate(input: GenerateVideoInput): Promise<GenerationJob>;
  getStatus(jobId: string, options?: { providerStatusUrl?: string }): Promise<GenerationResult>;
}
