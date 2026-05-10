/**
 * 테스트용 최소 PPTX 파일을 ArrayBuffer로 생성한다.
 * 바이너리 파일을 git에 커밋하지 않기 위해 런타임 생성.
 * JSZip으로 최소한의 PPTX ZIP 구조를 직접 만든다.
 *
 * PPTX 최소 구조:
 *   [Content_Types].xml   — ContentType 선언
 *   _rels/.rels           — 최상위 관계
 *   ppt/presentation.xml  — 프레젠테이션 루트
 *   ppt/slides/slide1.xml — 슬라이드 1 (가명 PII 포함)
 *   ppt/slides/slide2.xml — 슬라이드 2
 *   ppt/notesSlides/notesSlide1.xml — 슬라이드 1 노트
 */
import JSZip from 'jszip';

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/notesSlides/notesSlide1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="ppt/presentation.xml"/>
</Relationships>`;

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
    <p:sldId id="257" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
  </p:sldIdLst>
</p:presentation>`;

/** 슬라이드 XML 생성 헬퍼 */
function makeSlideXml(texts: string[]): string {
  const runs = texts.map(t =>
    `<a:r><a:t>${t}</a:t></a:r>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>${runs}</a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

/** 슬라이드 노트 XML 생성 헬퍼 */
function makeNoteXml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>${text}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;
}

/** 슬라이드 1에 삽입할 PII 샘플 텍스트 (가명 데이터) */
export const SLIDE1_TEXTS = ['A씨', '연락처: 010-9999-0000', '회사1 소속'];
/** 슬라이드 2에 삽입할 텍스트 */
export const SLIDE2_TEXTS = ['계약서 초안', '[주민번호-1] 확인 필요'];
/** 슬라이드 1 노트 텍스트 */
export const NOTE1_TEXT = '상담 메모: B씨 동석';

/**
 * 가명 PII가 포함된 2슬라이드 PPTX ArrayBuffer를 생성한다.
 * slide1: A씨, 010-9999-0000, 회사1 + 노트: B씨 동석
 * slide2: 계약서 초안, [주민번호-1]
 */
export async function makeMinimalPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('ppt/presentation.xml', PRESENTATION_XML);
  zip.file('ppt/slides/slide1.xml', makeSlideXml(SLIDE1_TEXTS));
  zip.file('ppt/slides/slide2.xml', makeSlideXml(SLIDE2_TEXTS));
  zip.file('ppt/notesSlides/notesSlide1.xml', makeNoteXml(NOTE1_TEXT));

  const blob = await zip.generateAsync({ type: 'arraybuffer' });
  return blob;
}
