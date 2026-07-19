/** Parsed brand + strength options from a Discovery Medicine List label. */
export interface ParsedMedicineLabel {
  brandName: string;
  strengths: string[];
  /** Original catalogue string (unchanged CSV value). */
  catalogueLabel: string;
}

const STRENGTH_SUFFIX_RE =
  /(\d[\d./]*\s*(?:mg|mcg|g|ml|iu|units?|dose|%)?(?:\/[\d./]+\s*(?:mg|mcg|g|ml|iu)?)?|\d+\/\d+(?:\s*mcg|\s*mg)?)\s*$/i;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Extract a strength token from a segment (e.g. "Epitec 100mg" → "100mg", "50mg" → "50mg"). */
export const extractStrengthFromSegment = (segment: string): string | null => {
  const trimmed = segment.trim();
  if (!trimmed) return null;
  const match = trimmed.match(STRENGTH_SUFFIX_RE);
  return match ? match[1].trim() : null;
};

/**
 * Parse Discovery's combined brand/strength field into brand name and strength options.
 * Examples:
 * - "Epitec 25mg; 50mg; 100mg; 200mg"
 * - "Partid 200mg"
 * - "Sereflo HFA 120 dose 25/50; 25/125; 25/250"
 */
export const parseMedicineLabel = (raw: string): ParsedMedicineLabel => {
  const catalogueLabel = raw.trim();
  if (!catalogueLabel) {
    return { brandName: '', strengths: [], catalogueLabel: '' };
  }

  const segments = catalogueLabel
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { brandName: catalogueLabel, strengths: [], catalogueLabel };
  }

  const strengths: string[] = [];
  let brandName = '';

  segments.forEach((segment, index) => {
    const strength = extractStrengthFromSegment(segment);
    if (strength) {
      strengths.push(strength);
      if (index === 0) {
        brandName = segment.replace(new RegExp(`\\s*${escapeRegExp(strength)}\\s*$`, 'i'), '').trim();
      }
    } else if (index === 0) {
      brandName = segment;
    }
  });

  if (strengths.length === 0) {
    return { brandName: catalogueLabel, strengths: [], catalogueLabel };
  }

  return {
    brandName: brandName || catalogueLabel,
    strengths,
    catalogueLabel,
  };
};

export const formatMedicineLabel = (brandName: string, strength: string): string => {
  const brand = brandName.trim();
  const dose = strength.trim();
  if (!brand) return dose;
  if (!dose) return brand;
  return `${brand} ${dose}`.replace(/\s+/g, ' ');
};

/** Stable key for duplicate detection (same catalogue row + strength). */
export const getMedicationSelectionKey = (catalogueLabel: string, strength: string): string =>
  `${catalogueLabel}::${strength || '__default__'}`;

export const resolveSelectedStrength = (parsed: ParsedMedicineLabel): string => {
  if (parsed.strengths.length === 1) return parsed.strengths[0];
  return '';
};
