import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogg', '.ogv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function isVideoUrl(url = '') {
  const lower = url.toLowerCase().split('?')[0];
  return VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function isImageUrl(url = '') {
  const lower = url.toLowerCase().split('?')[0];
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function detectUrlType(url = '') {
  if (isVideoUrl(url)) return 'video';
  if (isImageUrl(url)) return 'image';
  // Heurística por dominio/servicio conocido
  const lower = url.toLowerCase();
  if (lower.includes('youtu.be') || lower.includes('youtube.com') || lower.includes('streamable.com') || lower.includes('medal.tv') || lower.includes('clips.twitch.tv')) return 'video';
  return 'image'; // fallback: tratar como imagen
}

const ImageUpload = forwardRef(({ onImagesChange, maxImages = 5, globalPaste = false, disabled = false }, ref) => {
  const [images, setImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [pasteNotification, setPasteNotification] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const urlInputRef = useRef(null);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSizeBytes = 5 * 1024 * 1024;

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

  const processFiles = useCallback(async (files) => {
    setError('');
    const newImages = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) { setError(`Tipo no permitido: ${file.type}. Solo JPG, PNG, GIF, WEBP`); continue; }
      if (file.size > maxSizeBytes) { setError(`${file.name} excede 5MB`); continue; }
      if (images.length + newImages.length >= maxImages) { setError(`Máximo ${maxImages} imágenes`); break; }
      try {
        const base64 = await fileToBase64(file);
        newImages.push({ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, file, base64, name: file.name, type: file.type, size: file.size, preview: base64 });
      } catch (err) { setError('Error al procesar imagen'); }
    }
    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
    }
  }, [images, maxImages, onImagesChange]);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); if (e.target === dropZoneRef.current) setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) processFiles(files);
  };

  const handlePaste = useCallback(async (e) => {
    if (disabled) return;
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    const imageItems = Array.from(clipboardItems).filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      await processFiles(imageItems.map(item => item.getAsFile()).filter(Boolean));
    }
  }, [processFiles, disabled]);

  useImperativeHandle(ref, () => ({
    addFilesFromPaste: async (e) => {
      if (disabled) return false;
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return false;
      const imageItems = Array.from(clipboardItems).filter(item => item.type.startsWith('image/'));
      if (imageItems.length > 0) {
        e.preventDefault();
        await processFiles(imageItems.map(item => item.getAsFile()).filter(Boolean));
        setPasteNotification(true);
        setTimeout(() => setPasteNotification(false), 2000);
        return true;
      }
      return false;
    },
    getImages: () => images,
    clearImages: () => { setImages([]); onImagesChange?.([]); },
  }), [processFiles, images, onImagesChange, disabled]);

  React.useEffect(() => {
    const handleGlobalPaste = (e) => {
      if (globalPaste) { handlePaste(e); }
      else if (document.activeElement === dropZoneRef.current || dropZoneRef.current?.contains(document.activeElement)) { handlePaste(e); }
    };
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste, globalPaste]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  };

  const removeImage = (imageId) => {
    if (disabled) return;
    const updatedImages = images.filter(img => img.id !== imageId);
    setImages(updatedImages);
    onImagesChange?.(updatedImages);
  };

  const addUrlEvidence = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) { setError('La URL debe comenzar con http:// o https://'); return; }
    if (images.length >= maxImages) { setError(`Máximo ${maxImages} evidencias`); return; }
    setError('');
    const urlType = detectUrlType(trimmed);
    const urlName = trimmed.split('/').pop()?.split('?')[0] || 'evidencia';
    const newEntry = {
      id: `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isUrl: true,
      urlType,
      file: null,
      base64: null,
      name: urlName || 'evidencia',
      type: urlType === 'video' ? 'video/url' : 'image/url',
      size: 0,
      preview: trimmed,
    };
    const updated = [...images, newEntry];
    setImages(updated);
    onImagesChange?.(updated);
    setUrlInput('');
    urlInputRef.current?.focus();
  }, [urlInput, images, maxImages, onImagesChange]);

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isFull = images.length >= maxImages;

  return (
    <div className="image-upload">
      {pasteNotification && (
        <div className="image-upload__paste-notification">✅ ¡Imagen pegada correctamente!</div>
      )}

      {/* Tabs: Archivo / URL */}
      <div className="image-upload__tabs">
        <button
          type="button"
          className={`image-upload__tab${!urlMode ? ' image-upload__tab--active' : ''}`}
          onClick={() => { setUrlMode(false); setError(''); }}
          disabled={disabled}
        >📁 Archivo</button>
        <button
          type="button"
          className={`image-upload__tab${urlMode ? ' image-upload__tab--active' : ''}`}
          onClick={() => { setUrlMode(true); setError(''); }}
          disabled={disabled}
        >🔗 URL</button>
      </div>

      {/* Panel URL */}
      {urlMode ? (
        <div className="image-upload__url-panel">
          <div className="image-upload__url-row">
            <input
              ref={urlInputRef}
              type="url"
              className="image-upload__url-input"
              placeholder="https://ejemplo.com/evidencia.mp4 o .jpg ..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrlEvidence(); } }}
              disabled={disabled || images.length >= maxImages}
            />
            <button
              type="button"
              className="image-upload__url-add"
              onClick={addUrlEvidence}
              disabled={disabled || images.length >= maxImages || !urlInput.trim()}
            >Agregar</button>
          </div>
          <span className="image-upload__url-hint">Soporta imágenes y videos · Acepta YouTube, Streamable, Medal.tv, etc.</span>
        </div>
      ) : (
        /* Zona de Drop — se colapsa cuando está llena */
        <div
          ref={dropZoneRef}
          className={`image-upload__dropzone${isDragging ? ' image-upload__dropzone--active' : ''}${isFull ? ' image-upload__dropzone--full' : ''}${disabled ? ' image-upload__dropzone--disabled' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !disabled && !isFull && fileInputRef.current?.click()}
          onKeyDown={(e) => { if (!disabled && !isFull && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
          tabIndex={disabled || isFull ? -1 : 0}
          role="button"
          aria-label="Zona para subir imágenes"
        >
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleFileSelect} className="image-upload__input" aria-hidden="true" disabled={disabled} />

          {isFull ? (
            <span className="image-upload__full-msg">✔ {maxImages}/{maxImages} — límite alcanzado</span>
          ) : (
            <div className="image-upload__content">
              <div className="image-upload__icon" aria-hidden="true">{isDragging ? '📥' : '📷'}</div>
              <div className="image-upload__text">
                {isDragging ? (
                  <span className="image-upload__text--active">¡Suelta las imágenes aquí!</span>
                ) : (
                  <>
                    <span className="image-upload__text--primary">Arrastra imágenes aquí</span>
                    <span className="image-upload__text--secondary">o haz clic para seleccionar</span>
                    <span className="image-upload__text--hint">💡 También puedes usar <kbd>CTRL</kbd>+<kbd>V</kbd> para pegar</span>
                  </>
                )}
              </div>
              <div className="image-upload__limits">Máx. {maxImages} imágenes • JPG, PNG, GIF, WEBP • 5MB c/u</div>
            </div>
          )}
        </div>
      )}

      {error && <div className="image-upload__error" role="alert">⚠️ {error}</div>}

      {/* Galería — predomina cuando hay imágenes */}
      {images.length > 0 && (
        <div className="image-upload__preview-grid">
          {images.map((image) => (
            <div key={image.id} className="image-upload__preview-item">
              {image.isUrl && image.urlType === 'video' ? (
                <div className="image-upload__preview-video-thumb" title={image.preview}>🎬</div>
              ) : (
                <img src={image.preview} alt={`Vista previa: ${image.name}`} className="image-upload__preview-img" />
              )}
              <div className="image-upload__preview-overlay">
                <span className="image-upload__preview-name" title={image.name}>
                  {image.isUrl ? '🔗 ' : ''}{image.name.length > 15 ? image.name.substring(0, 12) + '...' : image.name}
                </span>
                <span className="image-upload__preview-size">{image.isUrl ? (image.urlType === 'video' ? 'video' : 'imagen') : formatSize(image.size)}</span>
              </div>
              <button
                type="button"
                className="image-upload__preview-remove"
                onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                disabled={disabled}
                aria-label={`Eliminar ${image.name}`}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="image-upload__counter">📎 {images.length} / {maxImages} evidencias adjuntas</div>
      )}

      <style>{`
        .image-upload {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* ── Tabs ── */
        .image-upload__tabs {
          display: flex;
          gap: 0;
          margin-bottom: 0.5rem;
          border-bottom: 1px solid var(--color-gray-light, #3a3a3a);
          flex-shrink: 0;
        }
        .image-upload__tab {
          flex: 1;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--color-text-muted, #9a9a9a);
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          padding: 0.35rem 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: -1px;
        }
        .image-upload__tab:hover:not(:disabled) { color: var(--color-cream, #e0e0a0); }
        .image-upload__tab--active {
          color: var(--color-red-alert, #ff3333);
          border-bottom-color: var(--color-red-alert, #ff3333);
        }
        .image-upload__tab:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Panel URL ── */
        .image-upload__url-panel {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 0.75rem;
          border: 1px dashed var(--color-gray-light, #3a3a3a);
          background: var(--color-black, #0a0a0a);
          flex: 1;
          min-height: 80px;
          justify-content: center;
        }
        .image-upload__url-row {
          display: flex;
          gap: 0.5rem;
        }
        .image-upload__url-input {
          flex: 1;
          background: var(--color-gray-dark, #1a1a1a);
          border: 1px solid var(--color-gray-light, #3a3a3a);
          color: var(--color-cream, #e0e0a0);
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          padding: 0.4rem 0.6rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .image-upload__url-input:focus { border-color: var(--color-red-alert, #ff3333); }
        .image-upload__url-input::placeholder { color: var(--color-text-muted, #9a9a9a); }
        .image-upload__url-input:disabled { opacity: 0.4; cursor: not-allowed; }
        .image-upload__url-add {
          background: var(--color-red-alert, #ff3333);
          color: #000;
          border: none;
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          font-weight: bold;
          padding: 0.4rem 0.9rem;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .image-upload__url-add:hover:not(:disabled) { background: #ff0000; }
        .image-upload__url-add:disabled { opacity: 0.4; cursor: not-allowed; }
        .image-upload__url-hint {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          color: var(--color-text-muted, #9a9a9a);
        }

        /* ── Thumbnail de video ── */
        .image-upload__preview-video-thumb {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          background: var(--color-gray-dark, #1a1a1a);
        }

        .image-upload__paste-notification {
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #000;
          padding: 0.5rem 1rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: bold;
          z-index: 100;
          animation: slideDown 0.3s ease, fadeOut 0.3s ease 1.7s forwards;
          white-space: nowrap;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOut { to { opacity: 0; } }

        .image-upload__dropzone {
          border: 2px dashed var(--color-gray-light, #3a3a3a);
          background: var(--color-black, #0a0a0a);
          text-align: center;
          cursor: pointer;
          transition: all 0.35s ease;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Estado normal: ocupa espacio */
          flex: 1;
          min-height: 120px;
          padding: 1.5rem 1rem;
        }

        /* Lleno: se colapsa a mínimo */
        .image-upload__dropzone--full {
          flex: 0 0 auto;
          min-height: 0;
          padding: 0.4rem 1rem;
          cursor: default;
          border-style: solid;
          border-color: var(--color-gray-light, #3a3a3a);
        }

        .image-upload__dropzone--disabled {
          opacity: 0.45;
          cursor: not-allowed;
          pointer-events: none;
        }

        .image-upload__dropzone::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,51,51,0.1), transparent);
          transition: left 0.5s ease;
        }
        .image-upload__dropzone:not(.image-upload__dropzone--full):hover::before,
        .image-upload__dropzone:not(.image-upload__dropzone--full):focus::before { left: 100%; }
        .image-upload__dropzone:not(.image-upload__dropzone--full):hover,
        .image-upload__dropzone:not(.image-upload__dropzone--full):focus {
          border-color: var(--color-red-alert, #ff3333);
          outline: none;
        }
        .image-upload__dropzone--active {
          border-color: var(--color-red-alert, #ff3333);
          background: rgba(255,51,51,0.1);
          transform: scale(1.02);
        }

        .image-upload__full-msg {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          color: var(--color-text-muted, #9a9a9a);
        }

        .image-upload__input { display: none; }

        .image-upload__content { position: relative; z-index: 1; }

        .image-upload__icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .image-upload__text { display: flex; flex-direction: column; gap: 0.25rem; }
        .image-upload__text--primary { font-family: var(--font-stencil, cursive); font-size: 1.1rem; color: var(--color-cream, #e0e0a0); }
        .image-upload__text--secondary { font-family: var(--font-typewriter, monospace); font-size: 0.9rem; color: var(--color-text-muted, #9a9a9a); }
        .image-upload__text--active { font-family: var(--font-stencil, cursive); font-size: 1.2rem; color: var(--color-red-alert, #ff3333); animation: blink 0.5s ease-in-out infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .image-upload__text--hint { font-family: var(--font-mono, monospace); font-size: 0.75rem; color: var(--color-text-muted, #9a9a9a); margin-top: 0.5rem; }
        .image-upload__text--hint kbd { background: var(--color-gray-medium, #2a2a2a); border: 1px solid var(--color-gray-light, #3a3a3a); border-radius: 3px; padding: 0.1rem 0.3rem; font-size: 0.7rem; }
        .image-upload__limits { font-family: var(--font-mono, monospace); font-size: 0.7rem; color: var(--color-text-muted, #9a9a9a); margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed var(--color-gray-medium, #2a2a2a); }

        .image-upload__error { background: rgba(255,51,51,0.2); border: 1px solid var(--color-red-alert, #ff3333); color: var(--color-red-alert, #ff3333); padding: 0.5rem 1rem; margin-top: 0.5rem; font-family: var(--font-mono, monospace); font-size: 0.8rem; }

        /* Galería: crece para llenar el espacio restante */
        .image-upload__preview-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          align-content: start;
          gap: 0.5rem;
          margin-top: 0.75rem;
          overflow-y: auto;
        }

        .image-upload__preview-item { position: relative; aspect-ratio: 1; border: 2px solid var(--color-gray-medium, #2a2a2a); overflow: hidden; transition: all 0.2s ease; }
        .image-upload__preview-item:hover { border-color: var(--color-red-alert, #ff3333); transform: scale(1.05); }
        .image-upload__preview-img { width: 100%; height: 100%; object-fit: cover; }
        .image-upload__preview-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 0.5rem 0.25rem 0.25rem; display: flex; flex-direction: column; }
        .image-upload__preview-name { font-family: var(--font-mono, monospace); font-size: 0.6rem; color: var(--color-cream, #e0e0a0); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .image-upload__preview-size { font-family: var(--font-mono, monospace); font-size: 0.55rem; color: var(--color-text-muted, #9a9a9a); }

        .image-upload__preview-remove {
          position: absolute; top: 0.25rem; right: 0.25rem;
          width: 1.5rem; height: 1.5rem;
          background: var(--color-red-alert, #ff3333); color: #000;
          border: none; font-size: 0.8rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s ease;
        }
        .image-upload__preview-item:hover .image-upload__preview-remove { opacity: 1; }
        .image-upload__preview-remove:hover { background: #ff0000; transform: scale(1.1); }
        .image-upload__preview-remove:disabled { cursor: not-allowed; }

        .image-upload__counter { font-family: var(--font-mono, monospace); font-size: 0.8rem; color: var(--color-cream, #e0e0a0); margin-top: 0.75rem; padding: 0.5rem; background: var(--color-gray-dark, #1a1a1a); border-left: 3px solid var(--color-red-alert, #ff3333); flex-shrink: 0; }

        @media (max-width: 480px) {
          .image-upload__dropzone { padding: 1.5rem 1rem; }
          .image-upload__icon { font-size: 2rem; }
          .image-upload__text--primary { font-size: 0.95rem; }
          .image-upload__preview-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
});

export default ImageUpload;
