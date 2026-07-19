export interface ParsedAttachment {
  name: string;
  type: string;
  data: string;
}

export const parseAttachment = (fileData: string): ParsedAttachment | null => {
  try {
    const parsed = JSON.parse(fileData) as ParsedAttachment;
    if (parsed?.data) return parsed;
  } catch {
    if (fileData.startsWith('data:')) {
      return { name: 'attachment', type: 'image/png', data: fileData };
    }
  }
  return null;
};

export const getAttachmentFileName = (fileData: string): string => {
  const parsed = parseAttachment(fileData);
  return parsed?.name || 'attachment';
};

export const getAttachmentFileType = (fileData: string): string => {
  const parsed = parseAttachment(fileData);
  return parsed?.type || 'application/octet-stream';
};

export const isImageAttachment = (fileData: string): boolean =>
  getAttachmentFileType(fileData).startsWith('image/');

export const isPdfAttachment = (fileData: string): boolean => {
  const type = getAttachmentFileType(fileData);
  const name = getAttachmentFileName(fileData).toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
};

export const canPreviewAttachment = (fileData: string): boolean =>
  isImageAttachment(fileData) || isPdfAttachment(fileData);

const dataUrlToBlob = (dataUrl: string, fallbackMime?: string): Blob => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid data URL');
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64Data = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || fallbackMime || 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

export const attachmentToBlob = (fileData: string): Blob | null => {
  const parsed = parseAttachment(fileData);
  if (!parsed?.data) return null;

  try {
    if (parsed.data.startsWith('data:')) {
      return dataUrlToBlob(parsed.data, parsed.type);
    }
    const binary = atob(parsed.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: parsed.type });
  } catch {
    return null;
  }
};

export const createAttachmentObjectUrl = (fileData: string): string | null => {
  const blob = attachmentToBlob(fileData);
  if (!blob) return null;
  return URL.createObjectURL(blob);
};

const triggerBlobNavigation = (
  blobUrl: string,
  fileName: string,
  mode: 'view' | 'download'
): void => {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.rel = 'noopener noreferrer';
  if (mode === 'download') {
    link.download = fileName;
  } else {
    link.target = '_blank';
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Open or download an attachment without window.open(dataUrl) — avoids about:blank#blocked */
export const openAttachment = (fileData: string): void => {
  const parsed = parseAttachment(fileData);
  const blobUrl = createAttachmentObjectUrl(fileData);
  if (!parsed || !blobUrl) return;

  const viewable = canPreviewAttachment(fileData);
  triggerBlobNavigation(blobUrl, parsed.name, viewable ? 'view' : 'download');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
};

export const downloadAttachment = (fileData: string): void => {
  const parsed = parseAttachment(fileData);
  const blobUrl = createAttachmentObjectUrl(fileData);
  if (!parsed || !blobUrl) return;

  triggerBlobNavigation(blobUrl, parsed.name, 'download');
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
};
