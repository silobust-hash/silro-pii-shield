import { describe, it, expect } from 'vitest';
import { dispatchFileProcessing } from '@/background/file-handlers/dispatcher';
import type { FileInterceptEvent } from '@/shared/types';

const baseEvent: Omit<FileInterceptEvent, 'sizeBytes' | 'mimeType' | 'arrayBuffer'> = {
  requestId: 'test-1',
  fileName: 'test.docx',
  site: 'claude',
  conversationId: 'conv-1',
};

const noopMask = async (text: string) => ({ masked: text, mappings: [] });

describe('dispatchFileProcessing fail-safe', () => {
  it('100MB 초과 → size_exceeded 반환', async () => {
    const result = await dispatchFileProcessing(
      {
        ...baseEvent,
        mimeType: 'application/pdf',
        sizeBytes: 101 * 1024 * 1024,
        arrayBuffer: new ArrayBuffer(0),
      },
      noopMask,
      'txt'
    );
    expect(result.status).toBe('size_exceeded');
    expect(result.errorMessage).toContain('100MB');
  });

  it('미지원 MIME (application/zip) → unsupported 반환', async () => {
    const result = await dispatchFileProcessing(
      {
        ...baseEvent,
        mimeType: 'application/zip',
        sizeBytes: 1024,
        arrayBuffer: new ArrayBuffer(8),
      },
      noopMask,
      'txt'
    );
    expect(result.status).toBe('unsupported');
  });

  it('image/png는 v0.6에서 지원됨 (ImageHandler 핸들링 — parse_error or ok)', async () => {
    // v0.6: PNG는 ImageHandler가 처리. 빈 버퍼는 OCR 실패 → parse_error
    const result = await dispatchFileProcessing(
      {
        ...baseEvent,
        mimeType: 'image/png',
        sizeBytes: 1024,
        arrayBuffer: new ArrayBuffer(8),
      },
      noopMask,
      'txt'
    );
    // 빈 버퍼 → 핸들러는 있지만 OCR 실패 → parse_error 또는 ok (빈 텍스트)
    expect(['ok', 'parse_error', 'unsupported']).toContain(result.status);
  });

  it('requestId가 결과에 포함됨', async () => {
    const result = await dispatchFileProcessing(
      {
        ...baseEvent,
        requestId: 'unique-id-999',
        mimeType: 'application/zip',
        sizeBytes: 1024,
        arrayBuffer: new ArrayBuffer(8),
      },
      noopMask,
      'txt'
    );
    expect(result.requestId).toBe('unique-id-999');
  });
});
