export enum ActivityStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ALERT = 'ALERT'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  locationName: string;
  coordinates: Coordinates;
  status: ActivityStatus;
  timestamp: string;
  source: 'UPLOAD' | 'WHATSAPP' | 'MANUAL';
  technician?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  processed: boolean;
}

export interface ReportConfig {
  startDate: string;
  endDate: string;
  focusArea: string;
}

export interface AnalysisResult {
  activities: Activity[];
  summary: string;
}