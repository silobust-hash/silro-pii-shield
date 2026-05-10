import { describe, it, expect } from 'vitest';

// happy-dom 환경에서 동작 검증 (DOM 생성·버튼 클릭 시뮬레이션)
describe('showKoreanNameConfirm', () => {
  it('returns empty result when pending is empty', async () => {
    const { showKoreanNameConfirm } = await import('@/content/confirm-dialog');
    const result = await showKoreanNameConfirm([]);
    expect(result.confirmed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('resolves with all skipped when skip button clicked', async () => {
    const { showKoreanNameConfirm } = await import('@/content/confirm-dialog');
    const pending = [
      {
        original: '홍길동',
        start: 0,
        end: 3,
        confidence: 0.75,
        contextSnippet: '홍길동씨가',
      },
    ];

    const promise = showKoreanNameConfirm(pending);
    // 다음 tick에 버튼 클릭 시뮬레이션
    await Promise.resolve();
    const skipBtn = document.querySelector('button');
    skipBtn?.click();

    const result = await promise;
    expect(result.confirmed).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
  });
});
