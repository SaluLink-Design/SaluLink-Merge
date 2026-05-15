'use client';

import { useState } from 'react';
import { Upload, X, Edit2, Check } from 'lucide-react';

interface FileUploadWithRenameProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxFiles?: number;
}

const FileUploadWithRename = ({ images, onImagesChange, maxFiles = 10 }: FileUploadWithRenameProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const newImages: string[] = [];

    for (const file of fileArray) {
      if (images.length + newImages.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        break;
      }

      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onloadend = () => {
          const fileData = {
            name: file.name,
            type: file.type,
            data: reader.result as string,
          };
          newImages.push(JSON.stringify(fileData));
          resolve(true);
        };
        reader.readAsDataURL(file);
      });
    }

    onImagesChange([...images, ...newImages]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const startEditing = (index: number) => {
    try {
      const parsed = JSON.parse(images[index]);
      const currentName = parsed.name.split('.')[0];
      setEditingName(currentName);
      setEditingIndex(index);
    } catch {
      setEditingName('file');
      setEditingIndex(index);
    }
  };

  const saveRename = (index: number) => {
    if (!editingName.trim()) {
      alert('File name cannot be empty');
      return;
    }

    try {
      const parsed = JSON.parse(images[index]);
      const extension = parsed.name.split('.').pop();
      parsed.name = `${editingName.trim()}.${extension}`;

      const newImages = [...images];
      newImages[index] = JSON.stringify(parsed);
      onImagesChange(newImages);

      setEditingIndex(null);
      setEditingName('');
    } catch (error) {
      alert('Error renaming file');
    }
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingName('');
  };

  const getFileName = (fileData: string): string => {
    try {
      const parsed = JSON.parse(fileData);
      return parsed.name;
    } catch {
      return 'Unknown file';
    }
  };

  const getFileType = (fileData: string): string => {
    try {
      const parsed = JSON.parse(fileData);
      return parsed.type;
    } catch {
      return 'application/octet-stream';
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Attach Files (Images, PDFs, Documents)</label>
        <div className="flex items-center gap-3">
          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
            <Upload className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              Upload Files ({images.length}/{maxFiles})
            </span>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              disabled={images.length >= maxFiles}
            />
          </label>
        </div>
      </div>

      {images.length > 0 && (
        <div className="space-y-2">
          {images.map((img, index) => {
            const fileName = getFileName(img);
            const fileType = getFileType(img);
            const isImage = fileType.startsWith('image/');

            return (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                {isImage && (
                  <img
                    src={JSON.parse(img).data}
                    alt={fileName}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                {!isImage && (
                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">
                      {fileName.split('.').pop()?.toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  {editingIndex === index ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(index);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                      <span className="text-sm text-gray-500">.{fileName.split('.').pop()}</span>
                      <button
                        onClick={() => saveRename(index)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{fileName}</p>
                      <button
                        onClick={() => startEditing(index)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Rename file"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">{fileType}</p>
                </div>

                {editingIndex !== index && (
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileUploadWithRename;
