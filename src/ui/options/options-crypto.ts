// Entry point: mounts crypto + export/import sections in the options page
import { renderMasterPasswordSection } from './master-password';
import { renderExportImportSection } from './export-import';

async function mountCryptoUI(): Promise<void> {
  const cryptoMount = document.getElementById('crypto-section-mount');
  if (cryptoMount) await renderMasterPasswordSection(cryptoMount);

  const exportMount = document.getElementById('export-import-section-mount');
  if (exportMount) await renderExportImportSection(exportMount);
}

void mountCryptoUI();
