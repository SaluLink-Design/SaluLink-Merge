import type { StateStorage } from 'zustand/middleware';
import { ClinicalAppeal, PatientCase, TreatmentItem } from '@/types';
import { normalizePatientCase } from '@/lib/normalizePatientCase';

const stripTreatmentImages = (t: TreatmentItem): TreatmentItem => ({
  ...t,
  documentation: {
    ...t.documentation,
    images: [],
  },
});

/** Remove embedded file payloads before writing to localStorage (keeps usage counts & notes). */
export const casesForLocalStorage = (cases: PatientCase[]): PatientCase[] =>
  cases.map((raw) => {
    const c = normalizePatientCase(raw);
    return {
      ...c,
      diagnosticTreatments: c.diagnosticTreatments.map(stripTreatmentImages),
      ongoingTreatments: c.ongoingTreatments.map(stripTreatmentImages),
      clinicalAppeals: c.clinicalAppeals?.map((a: ClinicalAppeal) => ({ ...a, images: [] })),
      medicationReports: c.medicationReports?.map((r) => ({
        ...r,
        originalMedications: r.originalMedications,
        newMedications: r.newMedications,
        documentation: r.documentation
          ? { ...r.documentation, images: [] }
          : r.documentation,
      })),
      medications: c.medications.map((m) =>
        m.documentation
          ? { ...m, documentation: { ...m.documentation, images: [] } }
          : m
      ),
    };
  });

const stripPersistedPayload = (value: string): string => {
  try {
    const parsed = JSON.parse(value) as {
      state?: { cases?: PatientCase[]; selectedPlan?: string };
      version?: number;
    };
    if (parsed.state?.cases) {
      parsed.state.cases = casesForLocalStorage(parsed.state.cases);
    }
    return JSON.stringify(parsed);
  } catch {
    return value;
  }
};

const MAX_LOCAL_STORAGE_CHARS = 4_000_000;

export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(name);
    if (!raw) return null;

    if (raw.length > MAX_LOCAL_STORAGE_CHARS) {
      const stripped = stripPersistedPayload(raw);
      try {
        localStorage.setItem(name, stripped);
      } catch {
        localStorage.removeItem(name);
        return null;
      }
      return stripped;
    }

    return raw;
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;

    const lightweight = stripPersistedPayload(value);

    try {
      localStorage.setItem(name, lightweight);
      return;
    } catch (error) {
      const isQuota =
        error instanceof DOMException &&
        (error.name === 'QuotaExceededError' || error.code === 22);

      if (!isQuota) throw error;

      try {
        localStorage.removeItem(name);
        localStorage.setItem(name, lightweight);
      } catch {
        console.warn(
          '[SaluLink] localStorage quota exceeded; clearing saved cases metadata. Attachments remain in IndexedDB when available.'
        );
        localStorage.removeItem(name);
      }
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
  },
};
