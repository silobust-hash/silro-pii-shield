/**
 * OCR Bridge 단위 테스트.
 *
 * 실제 Tesseract.js를 실행하면 느리고 학습 데이터 다운로드가 필요하므로,
 * Worker.postMessage를 mock해 즉시 응답을 시뮬레이션한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Worker global mock — happy-dom에서 Worker는 구현이 제한적이므로 직접 mock
const mockWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  terminate: vi.fn(),
};

// Worker 생성자 mock
vi.stubGlobal('Worker', vi.fn(() => mockWorker));

// crypto.randomUUID mock (happy-dom 지원 여부 불확실)
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234'),
});

import { runOcr, terminateOcrWorker } from '@/background/file-handlers/ocr-bridge';

describe('runOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminateOcrWorker(); // 각 테스트 전 Worker 초기화
  });

  afterEach(() => {
    terminateOcrWorker();
  });

  it('postMessage가 OCR_RUN 타입으로 호출된다', async () => {
    // Worker addEventListener가 등록되면 즉시 OCR_RESULT 응답 시뮬레이션
    mockWorker.addEventListener.mockImplementation(
      (event: string, handler: (e: MessageEvent) => void) => {
        if (event === 'message') {
          // 비동기로 응답
          setTimeout(() => {
            handler({
              data: {
                type: 'OCR_RESULT',
                id: 'test-uuid-1234',
                text: '테스트 텍스트',
                confidence: 0.85,
              },
            } as MessageEvent);
          }, 0);
        }
      }
    );

    const buf = new ArrayBuffer(8);
    const promise = runOcr(buf, 'image/jpeg');

    const result = await promise;
    expect(result.text).toBe('테스트 텍스트');
    expect(result.confidence).toBe(0.85);
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OCR_RUN',
        id: 'test-uuid-1234',
        mimeType: 'image/jpeg',
      }),
      expect.any(Array)
    );
  });

  it('OCR_ERROR 응답 시 Promise가 reject된다', async () => {
    mockWorker.addEventListener.mockImplementation(
      (event: string, handler: (e: MessageEvent) => void) => {
        if (event === 'message') {
          setTimeout(() => {
            handler({
              data: {
                type: 'OCR_ERROR',
                id: 'test-uuid-1234',
                error: 'OCR 처리 실패',
              },
            } as MessageEvent);
          }, 0);
        }
      }
    );

    const buf = new ArrayBuffer(8);
    await expect(runOcr(buf, 'image/png')).rejects.toThrow('OCR 처리 실패');
  });

  it('terminateOcrWorker 호출 후 Worker가 재생성된다', async () => {
    // Worker를 lazy-init
    mockWorker.addEventListener.mockImplementation(
      (_event: string, _handler: (e: MessageEvent) => void) => {}
    );
    terminateOcrWorker();
    expect(mockWorker.terminate).toHaveBeenCalledTimes(0); // 아직 생성 안 됨
  });
});
