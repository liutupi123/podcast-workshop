export enum StepStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface PodcastContent {
  title: string;
  intro: string;
  script: string;
}

export interface GeneratedImage {
  url: string;
  base64: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  bookName: string;
  content: PodcastContent;
}

export interface WorkflowState {
  currentStep: number;
  bookFile: File | null;
  bookFileBase64: string | null;
  bookMimeType: string | null;
  contentStatus: StepStatus;
  generatedContent: PodcastContent | null;
  coverStatus: StepStatus;
  generatedCover: GeneratedImage | null;
  error: string | null;
}