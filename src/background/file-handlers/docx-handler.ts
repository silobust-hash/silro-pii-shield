import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { FileHandler, ReconstructedFile } from './base';
import { ParseError } from './base';
import type { Mapping, ReconstructionMode } from '@/shared/types';

export class DocxHandler implements FileHandler {
  readonly defaultMode: ReconstructionMode = 'preserve';

  canHandle(file: { mimeType: string; magicBytes: Uint8Array }): boolean {
    return file.mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  async extractText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (err) {
      throw new ParseError(`DOCX 텍스트 추출 실패: ${String(err)}`, err);
    }
  }

  async reconstruct(
    originalBuffer: ArrayBuffer,
    mappings: Mapping[],
    mode: ReconstructionMode
  ): Promise<ReconstructedFile> {
    // mode='txt': 가명화된 텍스트를 .txt Blob으로 반환
    if (mode === 'txt') {
      const rawText = await this.extractText(originalBuffer);
      const maskedText = applyMappingsToText(rawText, mappings);
      const encoder = new TextEncoder();
      return {
        buffer: encoder.encode(maskedText).buffer as ArrayBuffer,
        fileName: 'document_masked.txt',
        mimeType: 'text/plain;charset=utf-8',
      };
    }

    // mode='preserve': ZIP 내부 XML 텍스트 노드 직접 교체
    try {
      const zip = await JSZip.loadAsync(originalBuffer);
      const docXml = zip.file('word/document.xml');
      if (!docXml) throw new ParseError('word/document.xml not found');

      let xmlContent = await docXml.async('string');
      // XML 텍스트 노드(<w:t>)만 교체 (태그 보존)
      xmlContent = applyMappingsToXml(xmlContent, mappings);
      zip.file('word/document.xml', xmlContent);

      const buffer = await zip.generateAsync({ type: 'arraybuffer' });
      return {
        buffer,
        fileName: 'document_masked.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    } catch (err) {
      if (err instanceof ParseError) throw err;
      throw new ParseError(`DOCX 재생성 실패: ${String(err)}`, err);
    }
  }
}

/** Mapping[]을 평문 텍스트에 적용 */
function applyMappingsToText(text: string, mappings: Mapping[]): string {
  // 긴 원본 먼저 교체 (부분 매칭 방지)
  const sorted = [...mappings].sort((a, b) => b.original.length - a.original.length);
  let result = text;
  for (const { original, alias } of sorted) {
    result = result.replaceAll(original, alias);
  }
  return result;
}

/**
 * OOXML document.xml에서 <w:t> 태그 내용만 교체.
 * 태그 속성, 네임스페이스, 서식 태그는 건드리지 않는다.
 */
function applyMappingsToXml(xml: string, mappings: Mapping[]): string {
  // <w:t> 또는 <w:t xml:space="preserve"> 내 텍스트 노드 교체
  return xml.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_match, open, content, close) => {
    const masked = applyMappingsToText(content, mappings);
    return `${open}${masked}${close}`;
  });
}
