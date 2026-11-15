// Export und Import als JSON-Datei.
//
// Auf dem iPhone geht der Export über das Teilen-Menü ("In Dateien sichern",
// iCloud, AirDrop). Ein Download-Link funktioniert in Home-Bildschirm-Apps
// nicht zuverlässig. Am Rechner wird die Datei normal heruntergeladen.

import * as store from './store.js';
import { dateKey } from './logic.js';
import { confirmDialog, toast } from './ui/dom.js';

function prefersShare() {
  return window.matchMedia('(pointer: coarse)').matches && typeof navigator.canShare === 'function';
}

export async function exportBackup() {
  const data = store.exportData();
  const json = JSON.stringify(data, null, 2);
  const name = `training-backup-${dateKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });

  if (prefersShare() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
    } catch (err) {
      // Abbruch im Teilen-Menü ist kein Fehler, aber auch kein Backup.
      if (err?.name === 'AbortError') return false;
      toast(`Teilen fehlgeschlagen: ${err.message}`);
      return false;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  await store.setMeta('lastBackupAt', data.exportedAt);
  toast('Backup erstellt');
  return true;
}

/** Öffnet die Dateiauswahl und spielt ein Backup ein. Liefert true bei Erfolg. */
export function importBackup() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(false);
      try {
        const obj = JSON.parse(await file.text());
        store.validateBackup(obj);
        const n = obj.data.trainings.length;
        const ok = await confirmDialog(
          `Das Backup vom ${new Date(obj.exportedAt).toLocaleDateString('de-DE')} enthält ${n} Trainings. Alle Daten in der App werden dadurch ersetzt.`,
          { title: 'Backup einspielen', ok: 'Ersetzen', danger: true });
        if (!ok) return resolve(false);
        await store.importData(obj);
        toast('Backup eingespielt');
        resolve(true);
      } catch (err) {
        toast(err instanceof SyntaxError ? 'Die Datei ist kein gültiges JSON.' : err.message, { duration: 6000 });
        resolve(false);
      }
    });
    input.click();
  });
}
