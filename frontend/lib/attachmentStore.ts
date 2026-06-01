import { ClinicalAppeal, PatientCase, TreatmentItem } from '@/types';
import { getTreatmentKey } from '@/lib/ongoingTreatmentUsage';

const DB_NAME = 'salulink-attachments';
const DB_VERSION = 1;
const STORE = 'bundles';

export interface CaseAttachmentBundle {
  diagnostic: Record<string, string[]>;
  ongoing: Record<string, string[]>;
  appeals: Record<string, string[]>;
  medicationReports: Record<string, string[]>;
}

const emptyBundle = (): CaseAttachmentBundle => ({
  diagnostic: {},
  ongoing: {},
  appeals: {},
  medicationReports: {},
});

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });

const treatmentImages = (t: TreatmentItem): string[] => t.documentation?.images ?? [];

export const extractAttachmentBundle = (caseData: PatientCase): CaseAttachmentBundle => {
  const bundle = emptyBundle();

  (caseData.diagnosticTreatments ?? []).forEach((t) => {
    const key = getTreatmentKey(t.code, t.description);
    if (treatmentImages(t).length) bundle.diagnostic[key] = treatmentImages(t);
  });

  (caseData.ongoingTreatments ?? []).forEach((t) => {
    const key = getTreatmentKey(t.code, t.description);
    if (treatmentImages(t).length) bundle.ongoing[key] = treatmentImages(t);
  });

  caseData.clinicalAppeals?.forEach((a: ClinicalAppeal) => {
    const key = getTreatmentKey(a.treatmentCode, a.treatmentDescription);
    if (a.images.length) bundle.appeals[key] = a.images;
  });

  caseData.medicationReports?.forEach((r) => {
    if (r.documentation?.images?.length) {
      bundle.medicationReports[r.id] = r.documentation.images;
    }
  });

  return bundle;
};

const mergeTreatmentImages = (
  treatments: TreatmentItem[],
  map: Record<string, string[]>
): TreatmentItem[] =>
  treatments.map((t) => {
    const key = getTreatmentKey(t.code, t.description);
    const images = map[key];
    if (!images?.length) return t;
    return {
      ...t,
      documentation: { ...t.documentation, images },
    };
  });

export const mergeAttachmentBundle = (
  caseData: PatientCase,
  bundle: CaseAttachmentBundle | null
): PatientCase => {
  if (!bundle) return caseData;

  return {
    ...caseData,
    diagnosticTreatments: mergeTreatmentImages(
      caseData.diagnosticTreatments ?? [],
      bundle.diagnostic
    ),
    ongoingTreatments: mergeTreatmentImages(caseData.ongoingTreatments ?? [], bundle.ongoing),
    clinicalAppeals: caseData.clinicalAppeals?.map((a) => {
      const key = getTreatmentKey(a.treatmentCode, a.treatmentDescription);
      return bundle.appeals[key]?.length ? { ...a, images: bundle.appeals[key] } : a;
    }),
    medicationReports: caseData.medicationReports?.map((r) => {
      const images = bundle.medicationReports[r.id];
      if (!images?.length || !r.documentation) return r;
      return { ...r, documentation: { ...r.documentation, images } };
    }),
  };
};

export const saveCaseAttachments = async (
  caseId: string,
  caseData: PatientCase
): Promise<void> => {
  try {
    const bundle = extractAttachmentBundle(caseData);
    const hasAny =
      Object.keys(bundle.diagnostic).length +
        Object.keys(bundle.ongoing).length +
        Object.keys(bundle.appeals).length +
        Object.keys(bundle.medicationReports).length >
      0;

    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    if (hasAny) {
      store.put(bundle, caseId);
    } else {
      store.delete(caseId);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('[SaluLink] Failed to save attachments to IndexedDB', e);
  }
};

export const loadCaseAttachments = async (
  caseId: string
): Promise<CaseAttachmentBundle | null> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(caseId);

    const bundle = await new Promise<CaseAttachmentBundle | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as CaseAttachmentBundle) ?? null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return bundle;
  } catch {
    return null;
  }
};

export const hydrateCasesWithAttachments = async (
  cases: PatientCase[]
): Promise<PatientCase[]> =>
  Promise.all(
    cases.map(async (c) => {
      const bundle = await loadCaseAttachments(c.id);
      return mergeAttachmentBundle(c, bundle);
    })
  );

export const deleteCaseAttachments = async (caseId: string): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(caseId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
};
