import type { MessageType, MessageResponse, FileInterceptEvent, FileProcessResult } from './types';

export function sendMessage<T = unknown>(message: MessageType): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }
      resolve(response.data as T);
    });
  });
}

// ── v0.4: File message types ──────────────────────────────────────────────────

export interface FileInterceptMessage {
  type: 'FILE_INTERCEPT';
  payload: FileInterceptEvent;
}

export interface FileProcessResultMessage {
  type: 'FILE_PROCESS_RESULT';
  payload: FileProcessResult;
}

export interface FileUploadProceedMessage {
  type: 'FILE_UPLOAD_PROCEED';
  requestId: string;
}

export interface FileUploadBlockMessage {
  type: 'FILE_UPLOAD_BLOCK';
  requestId: string;
  reason: string;
}
