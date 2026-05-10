import JSZip from 'jszip';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

/**
 * PPTX 파일 핸들러.
 * - 텍스트 추출: ppt/slides/slide{N}.xml + ppt/notesSlides/notesSlide{N}.xml 의 <a:t> 노드
 * - 재생성: preserve 모드에서 ZIP 내 XML textContent를 가명화된 값으로 교체
 * - 외부 서버 호출 0, innerHTML 사용 0
 */
export class PptxHandler implements FileHandler {
  readonly defaultMode: ReconstructionMode = 'preserve';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    return (
      file.mimeType ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const { texts } = await extractPptxContent(arrayBuffer);
      return texts.join('\n\n');
    } catch (err) {
      if (err instanceof ParseError) throw err;
      throw new ParseError(`PPTX 파싱 실패: ${String(err)}`, err);
    }
  }

  async reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    mode: ReconstructionMode
  ): Promise<ReconstructedFile> {
    if (mode === 'txt') {
      const rawText = await this.extractText(originalBuffer);
      const maskedText = applyMappingsToText(rawText, mappings);
      const encoder = new TextEncoder();
      return {
        buffer: encoder.encode(maskedText).buffer as ArrayBuffer,
        fileName: 'presentation_masked.txt',
        mimeType: 'text/plain;charset=utf-8',
      };
    }

    // preserve 모드: ZIP 내 <a:t> 텍스트를 가명화 후 재생성
    try {
      const blob = await reconstructPptxInPlace(originalBuffer, mappings);
      const buffer = await blob.arrayBuffer();
      return {
        buffer,
        fileName: 'presentation_masked.pptx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      };
    } catch (err) {
      throw new ParseError(`PPTX 재생성 실패: ${String(err)}`, err);
    }
  }
}

// ── 내부 구현 ────────────────────────────────────────────────────────────────

/** 슬라이드 이름 패턴 */
const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;
/** 슬라이드 노트 이름 패턴 */
const NOTE_PREFIX = 'ppt/notesSlides/notesSlide';

interface PptxContent {
  texts: string[];
  slideCount: number;
}

/**
 * PPTX ZIP을 열어 슬라이드 + 노트 텍스트를 순서대로 수집한다.
 * @throws ParseError ZIP 해제 또는 XML 파싱 실패 시
 */
async function extractPptxContent(arrayBuffer: ArrayBuffer): Promise<PptxContent> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err) {
    throw new ParseError('PPTX 파싱 실패: ZIP 해제 오류', err);
  }

  // 슬라이드 목록을 번호순으로 정렬
  const slideNames = Object.keys(zip.files)
    .filter(name => SLIDE_RE.test(name))
    .sort((a, b) => {
      // matchAll로 번호 추출 (SLIDE_RE은 global flag 없이 사용하면 안 됨)
      const numA = parseInt(a.match(SLIDE_RE)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(SLIDE_RE)?.[1] ?? '0', 10);
      return numA - numB;
    });

  const texts: string[] = [];

  for (const slideName of slideNames) {
    // 슬라이드 본문
    const xml = await zip.files[slideName].async('string');
    const slideText = extractTextFromXml(xml);
    if (slideText) texts.push(slideText);

    // 슬라이드 노트 (존재 시)
    const noteKey = slideName.replace('ppt/slides/slide', NOTE_PREFIX);
    if (zip.files[noteKey]) {
      const noteXml = await zip.files[noteKey].async('string');
      const noteText = extractTextFromXml(noteXml);
      if (noteText) texts.push('[노트] ' + noteText);
    }
  }

  return { texts, slideCount: slideNames.length };
}

/**
 * XML 문자열에서 <a:t> 태그의 텍스트 콘텐츠를 이어붙인다.
 *
 * 전략: 정규식으로 <a:t>...</a:t> 패턴을 직접 추출한다.
 * DOMParser의 네임스페이스 처리가 happy-dom / 브라우저마다 다를 수 있으므로
 * 정규식 기반 접근이 더 안정적이다.
 */
function extractTextFromXml(xml: string): string {
  const parts: string[] = [];
  // <a:t> 또는 <a:t xml:space="..."> 내 텍스트 수집
  const tagRe = /<a:t(?:[^>]*)>([\s\S]*?)<\/a:t>/g;
  for (const match of xml.matchAll(tagRe)) {
    const content = match[1];
    if (content) parts.push(content);
  }
  return parts.join(' ').trim();
}

/**
 * PPTX ZIP을 열어 슬라이드·노트의 <a:t> 텍스트를 가명화한 뒤 새 ZIP Blob을 반환.
 * 기존 서식(폰트·색상·레이아웃)은 XML 구조를 유지하므로 보존된다.
 */
async function reconstructPptxInPlace(
  arrayBuffer: ArrayBuffer,
  mappings: Mapping[]
): Promise<Blob> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideNames = Object.keys(zip.files).filter(name => SLIDE_RE.test(name));
  const noteNames = Object.keys(zip.files).filter(name =>
    name.startsWith(NOTE_PREFIX) && name.endsWith('.xml')
  );

  const allXmlNames = [...slideNames, ...noteNames];

  for (const xmlName of allXmlNames) {
    const xml = await zip.files[xmlName].async('string');
    const maskedXml = maskXmlTextNodes(xml, mappings);
    zip.file(xmlName, maskedXml);
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * XML 문자열에서 <a:t>...</a:t> 내용을 가명화된 텍스트로 교체.
 * 정규식 사용: DOM 직렬화보다 네임스페이스 선언을 안전하게 보존.
 */
function maskXmlTextNodes(xml: string, mappings: Mapping[]): string {
  // <a:t> or <a:t attr="..."> 태그 내 텍스트만 교체
  return xml.replace(/(<a:t[^>]*>)([\s\S]*?)(<\/a:t>)/g, (_m, open, content, close) => {
    const masked = applyMappingsToText(content, mappings);
    return `${open}${masked}${close}`;
  });
}

/** Mapping[]을 평문 텍스트에 적용 (긴 원본 먼저) */
function applyMappingsToText(text: string, mappings: Mapping[]): string {
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}

// ── slideCount 접근용 헬퍼 (테스트에서 직접 호출 가능) ───────────────────────

/** 슬라이드 수 포함 상세 추출 결과 */
export interface PptxExtractResult {
  text: string;
  slideCount: number;
}

/** 텍스트 + slideCount를 함께 반환하는 편의 함수 (테스트용) */
export async function extractPptx(arrayBuffer: ArrayBuffer): Promise<PptxExtractResult> {
  try {
    const { texts, slideCount } = await extractPptxContent(arrayBuffer);
    return { text: texts.join('\n\n'), slideCount };
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`PPTX 파싱 실패: ${String(err)}`, err);
  }
}
