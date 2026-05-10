import { vi } from 'vitest';

/** pdf.js mock 결과물 생성 헬퍼 */
export const FAKE_PDF_TEXT_PAGES = [
  '1페이지: 홍길동의 상담 내용입니다.',
  '2페이지: 주민번호 900101-1234567 확인.',
];

export function makeMockPdfDocument(pages: string[]) {
  return {
    numPages: pages.length,
    getPage: vi.fn().mockImplementation(async (pageNum: number) => ({
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: pages[pageNum - 1] }],
      }),
    })),
  };
}
