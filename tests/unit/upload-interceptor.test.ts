import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFetchInterceptor, uninstallFetchInterceptor } from '@/content/upload-interceptor';

describe('fetch interceptor', () => {
  let originalFetch: typeof fetch;
  let interceptedRequests: Array<{ url: string; file: File }>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    interceptedRequests = [];
    // mock을 먼저 설치 → installFetchInterceptor가 mock을 originalFetch로 캡처
    mockFetch = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    installFetchInterceptor({
      isUploadEndpoint: (url) => url.includes('/api/files'),
      onFileIntercepted: async (url, file) => {
        interceptedRequests.push({ url, file });
        return null; // null = 원본 파일 그대로 진행 (테스트용)
      },
    });
  });

  afterEach(() => {
    uninstallFetchInterceptor();
    globalThis.fetch = originalFetch;
  });

  it('파일 업로드 URL + FormData → onFileIntercepted 호출', async () => {
    const file = new File(['hello'], 'test.docx', { type: 'application/vnd.openxmlformats...' });
    const formData = new FormData();
    formData.append('file', file);

    await fetch('https://claude.ai/api/files', { method: 'POST', body: formData });

    expect(interceptedRequests).toHaveLength(1);
    expect(interceptedRequests[0].file.name).toBe('test.docx');
  });

  it('파일 없는 일반 fetch → 통과 (인터셉트 안 함)', async () => {
    await fetch('https://claude.ai/api/chat', { method: 'POST', body: '{}' });
    expect(interceptedRequests).toHaveLength(0);
  });

  it('비파일 업로드 URL → 통과', async () => {
    const file = new File(['hello'], 'test.docx');
    const formData = new FormData();
    formData.append('file', file);

    await fetch('https://claude.ai/api/chat', { method: 'POST', body: formData });
    expect(interceptedRequests).toHaveLength(0);
  });
});
