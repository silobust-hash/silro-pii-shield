/**
 * 테스트용 최소 DOCX 파일을 ArrayBuffer로 생성한다.
 * git에 바이너리 파일을 커밋하지 않기 위해 런타임 생성.
 * 실제 ZIP 구조를 만들지 않고, mammoth가 파싱 가능한 최소 구조를 반환.
 *
 * 전략: mammoth는 내부적으로 JSZip을 사용하므로,
 * 테스트에서는 mammoth 자체를 mock하고 extractText의 로직만 검증한다.
 */

export const FAKE_DOCX_TEXT = '홍길동의 주민번호는 900101-1234567이며, 연락처는 010-1234-5678입니다.';

/**
 * mammoth.extractRawText mock 결과 — 실제 DOCX 파싱 없이 텍스트 반환 검증에 사용
 */
export const makeMockMammothResult = (text: string) => ({
  value: text,
  messages: [],
});
