# silro-pii-shield 개인정보처리방침 (Privacy Policy)

**최종 업데이트: 2026-05-10**  
**버전: 1.0.0**  
**개발자: 박실로 공인노무사 / silobust@naver.com**

---

## 1. 수집 데이터 (Data Collected)

| 저장소 | 보관 데이터 | 보존 기간 |
|--------|-----------|----------|
| `chrome.storage.local` | 사용자 사전(UserDictionary) · 의뢰인 프로필(ClientProfile) · 마스터 비밀번호 salt (비밀번호 자체는 저장하지 않음) | 사용자가 직접 삭제 전까지 |
| `chrome.storage.session` | 대화별 가명화 매핑 (forward/reverse) | 탭을 닫으면 자동 삭제 |
| `chrome.storage.sync` | 사이트별 활성화 설정 · 재생성 모드 설정 (PII 포함 없음) | 사용자가 직접 삭제 전까지 |

**저장된 모든 데이터는 사용자 기기 내에만 존재합니다. 외부 서버로 전송되지 않습니다.**

---

## 2. 외부 전송 (External Transmissions)

**0건.** 이 확장 프로그램은:

- 분석 서비스(Analytics)를 사용하지 않습니다.
- 광고 네트워크를 포함하지 않습니다.
- 텔레메트리(원격 측정)를 수집하지 않습니다.
- 외부 API를 호출하지 않습니다.
- 제3자 SDK를 포함하지 않습니다.

유일한 외부 네트워크 요청: OCR 기능 최초 사용 시 Tesseract.js CDN에서 `kor.traineddata` (~10MB)를 다운로드하며, 이후 브라우저 IndexedDB에 캐시됩니다. 이 파일은 한국어 문자 인식 학습 데이터이며, 사용자 개인정보를 포함하지 않습니다.

---

## 3. 암호화 (Encryption)

- 데이터 암호화는 **선택 사항**입니다 (기본: 비활성).
- 활성화 시: **AES-GCM 256-bit** 암호화 적용.
- 키 파생: **PBKDF2 SHA-256, 310,000 iterations**.
- 마스터 비밀번호는 **브라우저 밖으로 절대 전송되지 않습니다**.
- salt만 `chrome.storage.local`에 저장되며, 비밀번호 자체와 파생 키(`CryptoKey`)는 메모리에만 존재합니다.
- 브라우저(탭) 종료 시 파생 키는 자동 삭제됩니다.

---

## 4. 권한 사용 목적 (Permissions Used)

| 권한 | 사용 목적 |
|------|----------|
| `storage` | 사용자 사전·프로필·설정 저장 |
| `sidePanel` | 매핑 조회 사이드패널 표시 |
| `activeTab` | 현재 탭에서 단축키 명령 실행 |
| `host_permissions` (4개 사이트) | 각 AI 사이트의 입력 텍스트 가로채기 |

접근하는 사이트: `claude.ai`, `chatgpt.com`, `gemini.google.com`, `perplexity.ai`

---

## 5. 데이터 내보내기 / 삭제

- **내보내기**: 옵션 페이지 → 데이터 내보내기/가져오기 섹션 → JSON 다운로드 (평문 또는 암호화 선택).
- **삭제**: Chrome 설정 → 확장 프로그램 → silro-pii-shield → 제거 시 모든 저장 데이터 삭제됨.

---

## 6. 오픈소스 & 감사

- **라이선스**: MIT License
- **소스코드**: [github.com/silobust-hash/silro-pii-shield](https://github.com/silobust-hash/silro-pii-shield)
- 모든 코드는 공개되어 있으며, 독립적인 보안 감사가 가능합니다.

---

## 7. 문의 (Contact)

보안 취약점 신고 또는 개인정보 관련 문의:  
**silobust@naver.com**

---

## 8. 개인정보처리방침 호스팅 안내

> **참고**: 이 방침 문서의 공개 URL은 Chrome Web Store 제출 전 다음 주소에 호스팅 예정입니다:  
> `https://silobust-hash.github.io/silro-pii-shield/PRIVACY.html`  
> (GitHub Pages — 사용자가 직접 배포 필요, INSTALL.md 참조)

---

*This privacy policy is available in Korean as the primary audience is Korean legal professionals. An English summary: This extension processes all data locally in the browser. Zero external data transmission. Optional AES-GCM encryption. Open source (MIT). Contact: silobust@naver.com*
