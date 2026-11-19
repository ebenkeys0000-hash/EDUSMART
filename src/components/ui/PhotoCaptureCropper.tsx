import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  RefreshCw,
  RotateCw,
  Upload,
  User,
  X,
  ZoomIn,
  ZoomOut,
  Move,
} from 'lucide-react';
import { apiRequest } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { AlertBanner, Button } from './DesignSystem.tsx';

interface PhotoCaptureCropperProps {
  value: string;
  onChange: (url: string) => void;
  ownerType: 'student' | 'teacher' | 'school_logo';
  required?: boolean;
  label?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_RAW_BYTES = 10 * 1024 * 1024;
const CROP_VIEW_W = 240;
const CROP_VIEW_H = 300; // 4:5 passport ID ratio
const EXPORT_W = 480;
const EXPORT_H = 600;

export const PhotoCaptureCropper: React.FC<PhotoCaptureCropperProps> = ({
  value,
  onChange,
  ownerType,
  required = true,
  label,
}) => {
  const { lang } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Cropper state
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setError(null);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          lang === 'fr'
            ? "La caméra directe n'est pas prise en charge par ce navigateur. Utilisez le bouton Importer une photo."
            : 'Live camera is unavailable on this browser. Please upload a photo from your device.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError(
        lang === 'fr'
          ? 'Accès caméra refusé ou indisponible. Vérifiez les permissions du navigateur ou importez une photo.'
          : 'Camera access denied or unavailable. Please allow camera permission or upload an image.'
      );
      stopCamera();
    }
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  const loadSourceIntoCropper = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      setImgMeta({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setCropSource(dataUrl);
    };
    img.onerror = () => {
      setError(
        lang === 'fr'
          ? "Impossible de lire ce fichier image. Utilisez JPEG, PNG ou WEBP."
          : 'Unable to read image file. Please select a valid JPEG, PNG, or WEBP photo.'
      );
    };
    img.src = dataUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setError(
        lang === 'fr'
          ? 'Format non supporté. Formats acceptés : JPEG, PNG ou WEBP.'
          : 'Unsupported file format. Please upload JPEG, PNG, or WEBP.'
      );
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setError(
        lang === 'fr'
          ? 'Image trop volumineuse (max 10 Mo avant recadrage).'
          : 'Image file exceeds 10MB limit.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadSourceIntoCropper(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    loadSourceIntoCropper(capturedDataUrl);
  };

  const getBaseScale = () => {
    if (!imgMeta) return 1;
    const rot90 = rotation === 90 || rotation === 270;
    const effW = rot90 ? imgMeta.h : imgMeta.w;
    const effH = rot90 ? imgMeta.w : imgMeta.h;
    return Math.max(CROP_VIEW_W / effW, CROP_VIEW_H / effH);
  };

  const handleApplyCropAndUpload = async () => {
    if (!cropSource || !imgMeta) return;
    setUploading(true);
    setError(null);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = cropSource;
      });

      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_W;
      canvas.height = EXPORT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

      const scaleFactor = EXPORT_W / CROP_VIEW_W;
      const baseScale = getBaseScale();
      const totalScale = baseScale * zoom * scaleFactor;

      ctx.save();
      ctx.translate(
        EXPORT_W / 2 + offset.x * scaleFactor,
        EXPORT_H / 2 + offset.y * scaleFactor
      );
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(totalScale, totalScale);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const uploaded = await apiRequest<{ url: string }>('/api/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl: croppedDataUrl,
          ownerType,
        }),
      });

      onChange(uploaded.url);
      setCropSource(null);
      setImgMeta(null);
    } catch (err: any) {
      setError(
        err?.message ||
          (lang === 'fr' ? "Échec de l'envoi de la photo." : 'Failed to upload cropped photo.')
      );
    } finally {
      setUploading(false);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({
      x: Math.max(-220, Math.min(220, dragRef.current.origX + dx)),
      y: Math.max(-240, Math.min(240, dragRef.current.origY + dy)),
    });
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-700 dark:text-slate-300">
          {label || (lang === 'fr' ? "Photo d'identité officielle" : 'Official ID Photograph')}{' '}
          {required && <span className="text-red-600 dark:text-red-400">*</span>}
        </label>
        <span className="text-[11px] text-slate-400">JPEG, PNG, WEBP · Max 2 Mo</span>
      </div>

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      {/* Camera Live Capture Box */}
      {cameraOpen && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 p-3 space-y-3">
          <div className="relative mx-auto aspect-[4/3] max-w-sm overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-38 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = facingMode === 'user' ? 'environment' : 'user';
                setFacingMode(next);
                startCamera(next);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Changer caméra' : 'Flip Camera'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleCaptureCameraFrame}>
              <Camera className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Capturer la photo' : 'Capture Photo'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={stopCamera}>
              <X className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Annuler' : 'Cancel'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Interactive Crop & Adjust Studio */}
      {cropSource && imgMeta && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#0F2744] dark:text-white flex items-center gap-1.5">
              <Move className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
              <span>
                {lang === 'fr'
                  ? 'Recadrer & ajuster le portrait (glisser-déposer)'
                  : 'Crop & adjust portrait (drag to position)'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setCropSource(null);
                setImgMeta(null);
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ width: CROP_VIEW_W, height: CROP_VIEW_H }}
              className="relative shrink-0 overflow-hidden rounded-xl border-2 border-[#1E40AF] bg-slate-900 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <img
                src={cropSource}
                alt="Recadrage"
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  maxWidth: 'none',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${
                    getBaseScale() * zoom
                  })`,
                  transformOrigin: 'center center',
                }}
              />
              {/* Rule of thirds alignment guide */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            </div>

            <div className="flex-1 space-y-3 w-full">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>{lang === 'fr' ? 'Zoom' : 'Zoom'}</span>
                  <span className="font-mono-tabular">{zoom.toFixed(2)}x</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <ZoomOut className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-[#1E40AF]"
                  />
                  <ZoomIn className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{lang === 'fr' ? 'Pivoter 90°' : 'Rotate 90°'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                    setOffset({ x: 0, y: 0 });
                  }}
                >
                  <span>{lang === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
                </Button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'fr'
                  ? 'Centrez le visage dans le cadre portrait (format carte scolaire/professionnelle). La photo est compressée et enregistrée de façon sécurisée.'
                  : 'Center the face inside the portrait frame. Photo is optimized and securely saved for ID card printing.'}
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={uploading}
                  onClick={handleApplyCropAndUpload}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {uploading
                      ? lang === 'fr'
                        ? 'Enregistrement...'
                        : 'Uploading...'
                      : lang === 'fr'
                      ? 'Valider & Enregistrer la photo'
                      : 'Confirm & Save Photo'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Preview + Upload / Camera Actions */}
      {!cropSource && !cameraOpen && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center">
            {value ? (
              <img
                src={value}
                alt={lang === 'fr' ? "Aperçu photo" : 'Photo preview'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                <User className="h-7 w-7" />
                <span className="mt-1 text-[10px] font-semibold">
                  {lang === 'fr' ? 'Requise' : 'Required'}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[200px] space-y-2">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {value
                ? lang === 'fr'
                  ? 'Photo prête pour la carte officielle. Vous pouvez la remplacer à tout moment.'
                  : 'Photo ready for official ID card generation. You can replace it anytime.'
                : lang === 'fr'
                ? 'Importez une photo depuis votre appareil ou prenez un cliché avec la caméra.'
                : 'Upload a photograph from your gallery/computer or capture one using your camera.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {value ? <Upload className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                <span>
                  {value
                    ? lang === 'fr'
                      ? 'Remplacer la photo'
                      : 'Replace Photo'
                    : lang === 'fr'
                    ? 'Importer une photo'
                    : 'Upload Photo'}
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => startCamera('user')}>
                <Camera className="h-3.5 w-3.5" />
                <span>{lang === 'fr' ? 'Prendre une photo' : 'Use Camera'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
