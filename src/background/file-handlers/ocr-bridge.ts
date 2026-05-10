/**
 * OCR Worker 브릿지 — lazy-load + Promise 기반 API.
 *
 * Service Worker / 핸들러 측에서 `await runOcr(imageData, mimeType)` 형태로 사용한다.
 * 첫 이미지 업로드 전까지 Web Worker를 생성하지 않아 초기 번들 비용 0.
 * ArrayBuffer를 transferable로 전달해 zero-copy로 Worker에 넘긴다.
 *
 * 외부 서버 호출 0. innerHTML 0.
 */
import type { OcrRequest, OcrResponse } from '@/shared/types';

/** Lazy-initialized OCR Web Worker 싱글톤 */
let ocrWorker: Worker | null = null;

/** 요청 ID → Promise resolver 맵 */
const pending = new Map<
  string,
  {
    resolve: (r: { text: string; confidence: number }) => void;
    reject: (e: Error) => void;
  }
>();

/**
 * OCR Worker를 lazy-init하고 반환한다.
 * 이미 초기화됐으면 기존 인스턴스를 재사용한다.
 */
function getOcrWorker(): Worker {
  if (!ocrWorker) {
    ocrWorker = new Worker(
      // Vite가 빌드 시 worker 번들을 별도 청크로 분리한다
      new URL('../../workers/ocr-worker.ts', import.meta.url),
      { type: 'module' }
    );

    ocrWorker.addEventListener('message', (e: MessageEvent<OcrResponse>) => {
      const msg = e.data;
      if (!msg?.id) return;
      const handlers = pending.get(msg.id);
      if (!handlers) return;
      pending.delete(msg.id);

      if (msg.type === 'OCR_RESULT') {
        handlers.resolve({ text: msg.text, confidence: msg.confidence });
      } else {
        handlers.reject(new Error(msg.error));
      }
    });

    ocrWorker.addEventListener('error', (e: ErrorEvent) => {
      // Worker 내부 uncaught error — reject 모든 pending 요청
      for (const [, handlers] of pending) {
        handlers.reject(new Error(`OCR Worker error: ${e.message}`));
      }
      pending.clear();
      ocrWorker = null; // 다음 요청 시 재생성
    });
  }
  return ocrWorker;
}

/**
 * 이미지 데이터를 OCR Worker에 전달하고 텍스트 + 신뢰도를 반환한다.
 *
 * @param imageData  이미지 ArrayBuffer (전달 후 caller는 사용 불가 — transferable)
 * @param mimeType   이미지 MIME 타입
 * @returns { text, confidence } — confidence 범위 0.0 ~ 1.0
 */
export function runOcr(
  imageData: ArrayBuffer,
  mimeType: OcrRequest['mimeType']
): Promise<{ text: string; confidence: number }> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pending.set(id, { resolve, reject });

    const request: OcrRequest = {
      type: 'OCR_RUN',
      id,
      imageData,
      mimeType,
    };

    // imageData를 transferable로 전달 (zero-copy)
    getOcrWorker().postMessage(request, [imageData]);
  });
}

/**
 * OCR Worker를 명시적으로 종료한다 (테스트 / cleanup 용).
 * 이후 runOcr() 호출 시 Worker가 재생성된다.
 */
export function terminateOcrWorker(): void {
  if (ocrWorker) {
    ocrWorker.terminate();
    ocrWorker = null;
  }
  pending.clear();
}
