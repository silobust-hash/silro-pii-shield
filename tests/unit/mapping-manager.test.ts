import { describe, it, expect, beforeEach } from 'vitest';
import { MappingManager } from '@/background/mapping-manager';
import { PIIDetector } from '@/background/pii-detector/detector';

describe('MappingManager.mask', () => {
  let manager: MappingManager;
  beforeEach(() => {
    manager = new MappingManager('conv-1', new PIIDetector());
  });

  it('주민등록번호를 [주민번호-1]로 치환한다', () => {
    const result = manager.mask('900101-1234567');
    expect(result.masked).toBe('[주민번호-1]');
    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].alias).toBe('[주민번호-1]');
    expect(result.mappings[0].original).toBe('900101-1234567');
  });
  it('전화번호를 [전화-1]로 치환한다', () => {
    expect(manager.mask('010-1234-5678').masked).toBe('[전화-1]');
  });
  it('이메일을 [이메일-1]로 치환한다', () => {
    expect(manager.mask('hong@a.com').masked).toBe('[이메일-1]');
  });
  it('사업자번호를 [사업자번호-1]로 치환한다', () => {
    expect(manager.mask('123-45-67890').masked).toBe('[사업자번호-1]');
  });
  it('사건번호를 [사건-1]로 치환한다', () => {
    expect(manager.mask('2024가합1234').masked).toBe('[사건-1]');
  });
  it('같은 값은 같은 가명을 받는다', () => {
    const result = manager.mask('010-1234-5678로 연락. 다시 010-1234-5678로 답신');
    expect(result.masked).toBe('[전화-1]로 연락. 다시 [전화-1]로 답신');
    expect(result.mappings).toHaveLength(1);
  });
  it('서로 다른 값은 서로 다른 가명을 받는다', () => {
    expect(manager.mask('010-1111-1111 와 010-2222-2222').masked).toBe('[전화-1] 와 [전화-2]');
  });
  it('카테고리별 카운터가 독립이다', () => {
    expect(manager.mask('900101-1234567 010-1111-1111 920202-2345678 010-2222-2222').masked).toBe('[주민번호-1] [전화-1] [주민번호-2] [전화-2]');
  });
});

describe('MappingManager.unmask', () => {
  let manager: MappingManager;
  beforeEach(() => {
    manager = new MappingManager('conv-2', new PIIDetector());
  });

  it('가명을 원래 값으로 복원한다', () => {
    manager.mask('홍길동(900101-1234567)');
    expect(manager.unmask('[주민번호-1]을 가진 사람')).toBe('900101-1234567을 가진 사람');
  });
  it('여러 가명을 한 번에 복원한다', () => {
    manager.mask('010-1111-1111, hong@a.com');
    expect(manager.unmask('[전화-1]로 [이메일-1]에 연락')).toBe('010-1111-1111로 hong@a.com에 연락');
  });
  it('등록되지 않은 가명은 그대로 둔다', () => {
    manager.mask('010-1111-1111');
    expect(manager.unmask('[전화-99]는 알 수 없음')).toBe('[전화-99]는 알 수 없음');
  });
  it('PII 미등록 시 원본 텍스트 그대로 반환', () => {
    expect(manager.unmask('일반 텍스트')).toBe('일반 텍스트');
  });
});

describe('MappingManager 직렬화', () => {
  it('toJSON으로 ConversationMappings를 반환한다', () => {
    const m = new MappingManager('conv-3', new PIIDetector());
    m.mask('010-1234-5678');
    const json = m.toJSON();
    expect(json.conversationId).toBe('conv-3');
    expect(json.forward['010-1234-5678']).toBe('[전화-1]');
    expect(json.reverse['[전화-1]']).toBe('010-1234-5678');
    expect(json.counters.phone).toBe(1);
  });
  it('fromJSON으로 상태를 복원한다', () => {
    const m1 = new MappingManager('conv-4', new PIIDetector());
    m1.mask('010-1234-5678');
    const json = m1.toJSON();
    const m2 = MappingManager.fromJSON(json, new PIIDetector());
    expect(m2.unmask('[전화-1]')).toBe('010-1234-5678');
    expect(m2.mask('010-1234-5678').masked).toBe('[전화-1]');
  });
});
