/**
 * OCR Web Worker — Tesseract.js 기반 한국어 OCR 전용 Worker.
 *
 * 이 파일은 브라우저 Web Worker 컨텍스트에서 실행된다.
 * Service Worker / 메인 스레드와 postMessage로만 통신하며,
 * CPU 집약적인 OCR 처리가 UI / Service Worker를 블로킹하지 않는다.
 *
 * 번들링 방식: Method B — Tesseract.js 기본 CDN(jsdelivr) lazy-fetch.
 * 첫 OCR 요청 시 kor.traineddata (~10MB)를 다운로드 후 IndexedDB에 캐시한다.
 * 오프라인 환경에서는 최초 1회 인터넷 연결 필요.
 *
 * 외부 OCR API 호출 0 — 모든 처리 브라우저 내 Tesseract.js로 수행.
 * innerHTML 사용 0.
 */
import { createWorker } from 'tesseract.js';
import type { OcrRequest, OcrResponse } from '@/shared/types';

/** Tesseract.js Worker 싱글톤 (lazy init) */
let tessWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

/**
 * Tesseract.js Worker를 초기화하거나 기존 인스턴스를 반환한다.
 * 첫 호출 시 kor.traineddata를 CDN에서 다운로드 (캐시 있으면 생략).
 */
async function getTessWorker() {
  if (!tessWorker) {
    // langPath를 생략하면 Tesseract.js가 기본 CDN(jsdelivr)에서 자동 다운로드
    tessWorker = await createWorker('kor', 1);
  }
  return tessWorker;
}

/**
 * OCR 요청 처리.
 * imageData: ArrayBuffer (transferable — zero-copy)
 * mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
 */
async function handleOcrRun(request: OcrRequest): Promise<void> {
  const { id, imageData, mimeType } = request;
  try {
    const worker = await getTessWorker();
    const blob = new Blob([imageData], { type: mimeType });
    const { data } = await worker.recognize(blob);
    const response: OcrResponse = {
      type: 'OCR_RESULT',
      id,
      text: data.text,
      // Tesseract.js confidence: 0-100 → normalize to 0.0-1.0
      confidence: data.confidence / 100,
    };
    self.postMessage(response);
  } catch (err) {
    const response: OcrResponse = {
      type: 'OCR_ERROR',
      id,
      error: String(err),
    };
    self.postMessage(response);
  }
}

/** Worker 메시지 수신 */
self.addEventListener('message', (event: MessageEvent<OcrRequest>) => {
  const req = event.data;
  if (req?.type === 'OCR_RUN') {
    handleOcrRun(req);
  }
});
