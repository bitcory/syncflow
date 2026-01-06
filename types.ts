export enum ContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

export interface SharedItem {
  id: string;
  type: ContentType;
  content: string; // Text content or Base64/URL for media (원본)
  thumbnailUrl?: string; // 압축된 썸네일 URL (이미지용)
  fileName?: string;
  sender: string; // User nickname
  senderImage?: string; // Kakao profile image
  senderId?: number; // Kakao user ID
  timestamp: number;
  aiAnalysis?: string; // Gemini generated summary or caption
  isProcessing?: boolean;
}

export interface DeviceProfile {
  id: string;
  name: string;
  type: 'mobile' | 'desktop' | 'laptop' | 'user';
  profileImage?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}