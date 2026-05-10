/**
 * 파일 재생성 모드 설정 UI.
 * - txt: 가명화 텍스트를 .txt로 변환 (기본값, 안전)
 * - preserve: 원본 포맷 유지 + PII 교체 (DOCX/XLSX만)
 * innerHTML 금지 — 모든 DOM은 createElement로 생성
 */

export function renderReconstructionModeSection(container: HTMLElement): void {
  const section = document.createElement('section');

  const heading = document.createElement('h3');
  heading.textContent = '파일 가명화 방식';
  section.appendChild(heading);

  const desc = document.createElement('p');
  desc.textContent =
    '파일 첨부 시 가명화 방식을 선택합니다. "텍스트 변환"이 더 안전하며, "원본 포맷 유지"는 DOCX/XLSX만 지원합니다.';
  section.appendChild(desc);

  const options: Array<{ value: 'txt' | 'preserve'; label: string; description: string }> = [
    { value: 'txt', label: '텍스트 변환 (.txt)', description: '모든 형식 지원. 서식은 제거됨.' },
    { value: 'preserve', label: '원본 포맷 유지', description: 'DOCX·XLSX만 지원. 서식 보존.' },
  ];

  chrome.storage.sync.get({ reconstructionMode: 'txt' }).then(({ reconstructionMode }) => {
    for (const opt of options) {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'reconstructionMode';
      radio.value = opt.value;
      radio.checked = reconstructionMode === opt.value;

      radio.addEventListener('change', () => {
        void chrome.storage.sync.set({ reconstructionMode: opt.value });
      });

      const span = document.createElement('span');
      span.textContent = `${opt.label} — ${opt.description}`;

      label.appendChild(radio);
      label.appendChild(span);
      section.appendChild(label);
    }
  });

  container.appendChild(section);
}
