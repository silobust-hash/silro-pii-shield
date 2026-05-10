# HWP.js Browser Compatibility Spike Report

**Date:** 2026-05-10  
**Evaluator:** silro-pii-shield agent (v0.5 implementation)

## Summary

**Conclusion: REJECT (Path B)**  
hwp.js cannot run in a browser extension context. Use explicit "unsupported" fallback with LibreOffice conversion guidance.

---

## Evaluation Results

| 항목 | 결과 |
|------|------|
| hwp.js npm 버전 | 0.0.3 |
| 브라우저 환경 ESM import 성공 여부 | **실패** |
| 샘플 HWP 텍스트 추출 성공 여부 | **불가** |
| HWPX 지원 여부 | **불가** |
| 번들 크기 (CJS 빌드) | ~392KB (gzip 미측정) |
| 평가 결론 | **REJECT** |

---

## 상세 원인

### 1. Node.js `fs` 모듈 의존성

hwp.js `build/cjs.js`가 `require('fs')`를 직접 호출한다:

```js
var require$$0 = require('fs');
```

Chrome Extension Service Worker, Content Script, Web Worker는 모두 브라우저 런타임으로 `fs` 모듈이 없다. 번들러(Vite)로 폴리필해도 `fs.readFileSync` 등의 실제 파일 시스템 접근은 불가능하다.

### 2. CFB(Compound File Binary) 파서가 Node Buffer 의존

hwp.js 내부 CFB 파서가 `Buffer`(Node.js 전용)를 직접 사용한다. `Uint8Array`로 대체되지 않아 브라우저에서 동작하지 않는다.

### 3. ESM 빌드도 동일 문제

`build/esm.js`도 내부적으로 CFB 파서를 포함하며 동일한 Node.js 의존성을 가진다.

### 4. 버전 상태

최신 버전 0.0.3 (2020년 기준, 현재까지 브라우저 지원 업데이트 없음). 유지보수가 사실상 중단된 상태.

---

## 결정: Path B — 명시적 미지원 폴백

HWP/HWPX 파일을 업로드하면 `HwpUnsupportedError`를 throw하고, Preflight Modal에서 LibreOffice DOCX 변환 안내를 표시한다.

- 외부 변환 API 호출: **0건** (URL 안내만, 자동 연결 없음)
- 사용자 행동: LibreOffice에서 수동으로 DOCX 변환 후 재업로드
- 보안: innerHTML 사용 없이 DOM API로만 안내 링크 생성

---

## 대안 (장기)

- WebAssembly 기반 HWP 파서가 출시되면 Path A로 전환 가능
- 또는 LibreOffice WebAssembly 포트가 완성되면 브라우저 내 변환 가능
- 현재 시점(2026-05)에는 실용적 솔루션 없음
