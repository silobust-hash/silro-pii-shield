import { describe, it, expect } from 'vitest';
import { detectEmail } from '@/background/pii-detector/regex/email';

describe('detectEmail', () => {
  it('일반 이메일을 감지한다', () => {
    const matches = detectEmail('연락 hong@example.com 으로');
    expect(matches).toHaveLength(1);
    expect(matches[0].original).toBe('hong@example.com');
  });
  it('한국 도메인을 감지한다', () => {
    expect(detectEmail('park@silro.co.kr')).toHaveLength(1);
    expect(detectEmail('test@naver.com')).toHaveLength(1);
  });
  it('+ 기호 포함 이메일을 감지한다', () => {
    expect(detectEmail('user+filter@gmail.com')).toHaveLength(1);
  });
  it('. 기호 포함 이메일을 감지한다', () => {
    expect(detectEmail('first.last@example.com')).toHaveLength(1);
  });
  it('@ 없는 텍스트는 감지하지 않는다', () => {
    expect(detectEmail('이메일 주소 없음')).toHaveLength(0);
  });
});
