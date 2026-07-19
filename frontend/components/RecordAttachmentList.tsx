'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';
import {
  canPreviewAttachment,
  createAttachmentObjectUrl,
  downloadAttachment,
  getAttachmentFileName,
  getAttachmentFileType,
  isImageAttachment,
  isPdfAttachment,
  openAttachment,
  parseAttachment,
} from '@/lib/attachmentDisplay';

interface RecordAttachmentListProps {
  attachments: string[];
  emptyMessage?: string;
}

const AttachmentPreviewModal = ({
  fileName,
  fileType,
  objectUrl,
  isImage,
  isPdf,
  onClose,
}: {
  fileName: string;
  fileType: string;
  objectUrl: string;
  isImage: boolean;
  isPdf: boolean;
  onClose: () => void;
}) => {
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div className="relative bg-white w-full sm:max-w-4xl max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Attachment</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{fileName}</p>
            <p className="text-xs text-slate-500">{fileType}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {isImage && (
            <img
              src={objectUrl}
              alt={fileName}
              className="max-w-full h-auto mx-auto rounded-lg border border-slate-200 bg-white"
            />
          )}
          {isPdf && (
            <iframe
              src={objectUrl}
              title={fileName}
              className="w-full min-h-[70vh] rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};

const RecordAttachmentList = ({
  attachments,
  emptyMessage = 'No files uploaded.',
}: RecordAttachmentListProps) => {
  const [preview, setPreview] = useState<{
    fileName: string;
    fileType: string;
    objectUrl: string;
    isImage: boolean;
    isPdf: boolean;
  } | null>(null);

  if (attachments.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  const handleView = (fileData: string) => {
    const parsed = parseAttachment(fileData);
    const objectUrl = createAttachmentObjectUrl(fileData);
    if (!parsed || !objectUrl) return;

    if (canPreviewAttachment(fileData)) {
      setPreview({
        fileName: parsed.name,
        fileType: parsed.type,
        objectUrl,
        isImage: isImageAttachment(fileData),
        isPdf: isPdfAttachment(fileData),
      });
      return;
    }

    openAttachment(fileData);
  };

  return (
    <>
      <div className="space-y-2">
        {attachments.map((fileData, index) => {
          const parsed = parseAttachment(fileData);
          if (!parsed) return null;
          const fileName = getAttachmentFileName(fileData);
          const fileType = getAttachmentFileType(fileData);
          const isImage = isImageAttachment(fileData);
          const previewable = canPreviewAttachment(fileData);

          return (
            <div
              key={`${fileName}-${index}`}
              className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl"
            >
              {isImage ? (
                <img
                  src={parsed.data}
                  alt={fileName}
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{fileName}</p>
                <p className="text-xs text-slate-500">{fileType}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleView(fileData)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewable ? 'View' : 'Open'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadAttachment(fileData)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Download file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <AttachmentPreviewModal
          fileName={preview.fileName}
          fileType={preview.fileType}
          objectUrl={preview.objectUrl}
          isImage={preview.isImage}
          isPdf={preview.isPdf}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
};

export default RecordAttachmentList;
