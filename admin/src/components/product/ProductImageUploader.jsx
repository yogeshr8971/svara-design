import React, { useState, useRef } from 'react';
import { Upload, X, RefreshCw, ZoomIn, Image as ImageIcon, AlertCircle } from 'lucide-react';

const MAX_IMAGES = 4;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Reusable Visual Box-Style Product Photo Uploader (§6).
 *
 * Props:
 * - images: Array of image objects or URLs ({ url, file, id })
 * - onChange: (newImagesArray) => void
 * - maxImages: number (default 4)
 * - disabled: boolean
 */
export default function ProductImageUploader({
  images = [],
  onChange,
  maxImages = MAX_IMAGES,
  disabled = false,
}) {
  const [previewModalUrl, setPreviewModalUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDraggingSlot, setIsDraggingSlot] = useState(null);
  const fileInputRefs = useRef({});

  // Normalize images to array of length `maxImages` slots
  const slots = Array.from({ length: maxImages }, (_, index) => images[index] || null);

  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, or WEBP image formats are supported.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds maximum 10MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
    }
    return null;
  };

  const handleFileSelect = (slotIndex, file) => {
    setErrorMsg('');
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setErrorMsg(error);
      return;
    }

    // Create a local blob preview url
    const previewUrl = URL.createObjectURL(file);
    const newImageItem = {
      file,
      url: previewUrl,
      isNew: true,
      name: file.name,
    };

    const nextImages = [...images];
    nextImages[slotIndex] = newImageItem;
    // Filter out undefined items up to the max index
    const compacted = nextImages.filter(Boolean);
    onChange(compacted);
  };

  const handleRemove = (slotIndex, e) => {
    e.stopPropagation();
    setErrorMsg('');
    const nextImages = images.filter((_, idx) => idx !== slotIndex);
    onChange(nextImages);
    if (fileInputRefs.current[slotIndex]) {
      fileInputRefs.current[slotIndex].value = '';
    }
  };

  const handleTriggerInput = (slotIndex) => {
    if (disabled) return;
    if (fileInputRefs.current[slotIndex]) {
      fileInputRefs.current[slotIndex].click();
    }
  };

  const handleDragOver = (slotIndex, e) => {
    e.preventDefault();
    if (!disabled) setIsDraggingSlot(slotIndex);
  };

  const handleDragLeave = (slotIndex, e) => {
    e.preventDefault();
    setIsDraggingSlot(null);
  };

  const handleDrop = (slotIndex, e) => {
    e.preventDefault();
    setIsDraggingSlot(null);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(slotIndex, file);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-700">
            Product Photographs ({images.length} / {maxImages})
          </label>
          <p className="text-[11px] text-charcoal-400">
            Select up to {maxImages} visual angles. Primary photo will be the main listing cover.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Visual Rectangular Boxes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {slots.map((item, index) => {
          const isOccupied = Boolean(item);
          const imageUrl = typeof item === 'string' ? item : item?.url;
          const isPrimary = index === 0;

          return (
            <div
              key={index}
              onDragOver={(e) => handleDragOver(index, e)}
              onDragLeave={(e) => handleDragLeave(index, e)}
              onDrop={(e) => handleDrop(index, e)}
              onClick={() => !isOccupied && handleTriggerInput(index)}
              className={`relative aspect-[3/4] rounded-2xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center text-center p-3 group ${
                isDraggingSlot === index
                  ? 'border-burgundy-500 bg-burgundy-50/50 scale-[1.02]'
                  : isOccupied
                  ? 'border-ivory-300 bg-white shadow-xs'
                  : 'border-dashed border-ivory-300 hover:border-burgundy-400 bg-ivory-100/50 hover:bg-ivory-100 cursor-pointer'
              } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <input
                ref={(el) => (fileInputRefs.current[index] = el)}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(index, file);
                }}
              />

              {isOccupied ? (
                <>
                  {/* Photo Display */}
                  <img
                    src={imageUrl}
                    alt={`Product photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Primary Badge */}
                  {isPrimary && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-charcoal-900/85 text-white shadow-xs">
                      Cover Photo
                    </span>
                  )}

                  {/* Slot Number */}
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-charcoal-900/60 text-white">
                    #{index + 1}
                  </span>

                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-charcoal-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewModalUrl(imageUrl);
                      }}
                      className="p-2 rounded-xl bg-white/90 text-charcoal-800 hover:bg-white hover:scale-110 transition-all shadow-xs"
                      title="Enlarge preview"
                    >
                      <ZoomIn size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerInput(index);
                      }}
                      className="p-2 rounded-xl bg-white/90 text-charcoal-800 hover:bg-white hover:scale-110 transition-all shadow-xs"
                      title="Replace photo"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(index, e)}
                      className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 hover:scale-110 transition-all shadow-xs"
                      title="Remove photo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </>
              ) : (
                /* Empty Upload Box */
                <div className="space-y-2 select-none">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto text-charcoal-400 group-hover:text-burgundy-600 group-hover:scale-110 transition-all shadow-xs border border-ivory-200">
                    <Upload size={18} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-charcoal-700 group-hover:text-burgundy-700">
                      {isPrimary ? 'Add Cover Photo' : `Add Photo #${index + 1}`}
                    </span>
                    <span className="block text-[10px] text-charcoal-400 mt-0.5">Click or drag</span>
                  </div>
                  <span className="inline-block text-[9px] text-charcoal-400 bg-white/70 px-1.5 py-0.5 rounded border border-ivory-200/80">
                    JPG, PNG, WEBP (≤10MB)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enlarged Photo Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/80 backdrop-blur-xs">
          <div className="relative max-w-3xl w-full max-h-[90vh] bg-white rounded-3xl p-4 overflow-hidden shadow-2xl flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-charcoal-900/70 hover:bg-charcoal-900 text-white transition-colors z-10"
            >
              <X size={20} />
            </button>
            <img
              src={previewModalUrl}
              alt="Enlarged photo preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
