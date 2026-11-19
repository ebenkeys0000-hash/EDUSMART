import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Save,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  QrCode,
  Camera,
  CameraOff,
  UserCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportTableToPdf, exportToExcel } from '../../lib/exports.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
  SegmentedTabs,
} from '../ui/DesignSystem.tsx';

interface AttendanceEntry {
  studentId: number;
  registrationNumber: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  remarks: string;
}

interface ScanResultItem {
  verified: boolean;
  alreadyMarked: boolean;
  scannedAt: string;
  attendance: {
    status: string;
    date: string;
    remarks: string;
  };
  student: {
    id: number;
    registrationNumber: string;
    firstName: string;
    lastName: string;
    className: string;
    photoUrl?: string;
    parentPhone?: string;
  };
}

export const AttendanceModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [tab, setTab] = useState<'register' | 'scanner' | 'reports'>('register');
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<any>(null);

  // QR Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'present' | 'late'>('present');
  const [scanDate, setScanDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualCode, setManualCode] = useState('');
  const [scanningBusy, setScanningBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<ScanResultItem | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanResultItem[]>([]);

  const playConfirmationBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // Audio playback blocked or unsupported
    }
  };

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const submitQrScan = useCallback(
    async (qrData: string) => {
      const trimmed = qrData.trim();
      if (!trimmed) return;
      setScanningBusy(true);
      setScanError(null);
      try {
        const res = await apiRequest<ScanResultItem>('/api/attendance/scan-qr', {
          method: 'POST',
          body: JSON.stringify({
            qrData: trimmed,
            date: scanDate,
            status: scanStatus,
          }),
        });
        playConfirmationBeep();
        setLastScanResult(res);
        setScanHistory((prev) => [res, ...prev.slice(0, 19)]);
        setManualCode('');
      } catch (err: any) {
        setScanError(err.message);
      } finally {
        setScanningBusy(false);
      }
    },
    [scanDate, scanStatus]
  );

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          lang === 'fr'
            ? "La caméra n'est pas disponible sur ce navigateur. Utilisez la saisie manuelle ou un lecteur USB."
            : 'Camera is unavailable in this browser. Use manual entry or a USB scanner.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraError(
        lang === 'fr'
          ? 'Accès caméra refusé ou indisponible. Vérifiez les permissions du navigateur.'
          : 'Camera permission denied or unavailable. Please check browser permissions.'
      );
      stopCamera();
    }
  };

  useEffect(() => {
    if (!cameraActive || tab !== 'scanner') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => {});

    let lastFrameAt = 0;
    const tick = (now: number) => {
      if (!streamRef.current) return;
      if (now - lastFrameAt >= 90 && video.readyState === video.HAVE_ENOUGH_DATA) {
        lastFrameAt = now;
        const canvas = canvasRef.current;
        if (canvas && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (decoded?.data) {
              const code = decoded.data.trim();
              const prev = lastScanRef.current;
              if (code && (code !== prev.code || Date.now() - prev.at > 3500)) {
                lastScanRef.current = { code, at: Date.now() };
                submitQrScan(code);
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, tab, submitQrScan]);

  useEffect(() => {
    if (tab !== 'scanner') {
      stopCamera();
    }
  }, [tab, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    apiRequest<{ classes: { id: number; name: string }[] }>('/api/academics/structure').then(
      (res) => {
        setClasses(res.classes);
        if (res.classes[0]) setClassId(String(res.classes[0].id));
      }
    );
  }, []);

  useEffect(() => {
    if (!classId) return;
    apiRequest<{ items: AttendanceEntry[] }>(
      `/api/attendance?classId=${classId}&date=${date}`
    ).then((res) => setEntries(res.items));
  }, [classId, date]);

  useEffect(() => {
    if (tab !== 'reports') return;
    apiRequest(`/api/attendance/reports?month=${month}`).then(setReport);
  }, [tab, month]);

  const setStatus = (studentId: number, status: AttendanceEntry['status']) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, status } : e)));
  };

  const setRemark = (studentId: number, remarks: string) => {
    setEntries((prev) => prev.map((e) => (e.studentId === studentId ? { ...e, remarks } : e)));
  };

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await apiRequest('/api/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({ classId: Number(classId), date, entries }),
      });
      setNotice(
        lang === 'fr'
          ? `Appel du ${date} enregistré avec succès (${entries.length} élèves).`
          : `Attendance for ${date} saved (${entries.length} students).`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Gestion des Présences' : 'Attendance Management'}
        subtitle={
          lang === 'fr'
            ? 'Appel quotidien, scanner de carte QR, retards et statistiques mensuelles'
            : 'Daily roll call, QR ID card scanner, tardiness, and monthly reports'
        }
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'register',
                label: lang === 'fr' ? 'Appel quotidien' : 'Daily Register',
              },
              {
                id: 'scanner',
                label: lang === 'fr' ? 'Scanner Carte QR' : 'QR Card Scanner',
                icon: <QrCode className="h-3.5 w-3.5" />,
              },
              {
                id: 'reports',
                label: lang === 'fr' ? 'Rapports & Statistiques' : 'Reports & Stats',
              },
            ]}
          />
        }
      />

      {notice && <AlertBanner type="success">{notice}</AlertBanner>}

      {tab === 'register' ? (
        <div className="space-y-4">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={`${inputBaseClass} w-44 font-medium`}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`${inputBaseClass} w-40 font-mono-tabular`}
                />
              </div>

              <Button
                variant="primary"
                disabled={saving || entries.length === 0}
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
                <span>
                  {saving ? '...' : lang === 'fr' ? 'Enregistrer l’appel' : 'Save Attendance'}
                </span>
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Matricule</th>
                    <th className="px-4 py-3 font-semibold">Élève</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Observations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                        Aucun élève actif dans cette classe.
                      </td>
                    </tr>
                  ) : (
                    entries.map((e) => (
                      <tr key={e.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                          {e.registrationNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {e.studentName}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                            {(
                              [
                                ['present', 'Présent', 'text-emerald-700 dark:text-emerald-400'],
                                ['absent', 'Absent', 'text-red-700 dark:text-red-400'],
                                ['late', 'Retard', 'text-amber-700 dark:text-amber-400'],
                                ['excused', 'Excusé', 'text-slate-700 dark:text-slate-200'],
                              ] as const
                            ).map(([val, label, activeColor]) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setStatus(e.studentId, val)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                                  e.status === val
                                    ? `bg-white dark:bg-slate-700 ${activeColor} shadow-xs`
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={e.remarks}
                            onChange={(ev) => setRemark(e.studentId, ev.target.value)}
                            placeholder="Motif..."
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#1E40AF]"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      ) : tab === 'scanner' ? (
        <div className="space-y-5">
          {/* Scanner Controls Bar */}
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'fr' ? 'Date :' : 'Date:'}
                  </span>
                  <input
                    type="date"
                    value={scanDate}
                    onChange={(e) => setScanDate(e.target.value)}
                    className={`${inputBaseClass} w-36 font-mono-tabular`}
                  />
                </div>

                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setScanStatus('present')}
                    className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                      scanStatus === 'present'
                        ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {lang === 'fr' ? 'Marquer Présent' : 'Mark Present'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanStatus('late')}
                    className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                      scanStatus === 'late'
                        ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {lang === 'fr' ? 'Marquer Retard' : 'Mark Late'}
                  </button>
                </div>
              </div>

              {cameraActive ? (
                <Button variant="danger" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4" />
                  <span>{lang === 'fr' ? 'Arrêter la caméra' : 'Stop Camera'}</span>
                </Button>
              ) : (
                <Button variant="primary" onClick={startCamera}>
                  <Camera className="h-4 w-4" />
                  <span>
                    {lang === 'fr' ? 'Activer le scanner caméra' : 'Start Camera Scanner'}
                  </span>
                </Button>
              )}
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Camera Viewport + Manual/USB Scanner */}
            <div className="lg:col-span-7 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950">
                <div className="relative aspect-video w-full flex items-center justify-center">
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-48 w-48 rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.38)]" />
                      </div>
                      <span className="absolute bottom-3 left-3 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white">
                        {lang === 'fr'
                          ? 'Placez le QR code du verso de la carte devant la caméra'
                          : 'Hold the ID card back QR code inside the frame'}
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <QrCode className="h-12 w-12 text-slate-500" />
                      <p className="mt-3 text-sm font-semibold text-white">
                        {lang === 'fr'
                          ? 'Scanner de Carte Scolaire prêt'
                          : 'School ID Card Scanner Ready'}
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        {lang === 'fr'
                          ? 'Activez la caméra pour lire automatiquement les cartes scolaires, ou utilisez un lecteur USB / la saisie ci-dessous.'
                          : 'Start the camera to scan student ID cards automatically, or use a USB barcode/QR scanner below.'}
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#0F2744] hover:bg-slate-100 cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        <span>{lang === 'fr' ? 'Ouvrir la caméra' : 'Open Camera'}</span>
                      </button>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {cameraError && <AlertBanner type="warning">{cameraError}</AlertBanner>}

              {/* Manual / USB Scanner Input */}
              <SurfaceCard padding="sm">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitQrScan(manualCode);
                  }}
                >
                  <label className="block text-xs font-semibold text-[#0F2744] dark:text-white">
                    {lang === 'fr'
                      ? 'Lecteur QR USB ou Saisie Matricule'
                      : 'USB QR Scanner or Manual ID Entry'}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="EDUSMART:CODE:EDU-2026-0001 ou EDU-2026-0001"
                      className={`${inputBaseClass} flex-1 font-mono-tabular`}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={scanningBusy || !manualCode.trim()}
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>{scanningBusy ? '...' : lang === 'fr' ? 'Vérifier' : 'Verify'}</span>
                    </Button>
                  </div>
                </form>
              </SurfaceCard>
            </div>

            {/* Verification Output & Session Log */}
            <div className="lg:col-span-5 space-y-4">
              {scanError && (
                <AlertBanner type="error">
                  <p className="font-bold">
                    {lang === 'fr' ? 'Carte non reconnue' : 'Verification Failed'}
                  </p>
                  <p className="mt-0.5">{scanError}</p>
                </AlertBanner>
              )}

              {lastScanResult ? (
                <SurfaceCard className="border-emerald-200 dark:border-emerald-900/60">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {lastScanResult.alreadyMarked
                          ? lang === 'fr'
                            ? 'Présence mise à jour'
                            : 'Attendance Updated'
                          : lang === 'fr'
                          ? 'Présence validée'
                          : 'Attendance Verified'}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {lastScanResult.scannedAt}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {lastScanResult.student.photoUrl ? (
                      <img
                        src={lastScanResult.student.photoUrl}
                        alt={lastScanResult.student.firstName}
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <User className="h-7 w-7" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold text-[#0F2744] dark:text-white">
                        {lastScanResult.student.firstName} {lastScanResult.student.lastName}
                      </h3>
                      <p className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                        {lang === 'fr' ? 'Classe : ' : 'Class: '}
                        {lastScanResult.student.className}
                      </p>
                      <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                        {lastScanResult.student.registrationNumber} ·{' '}
                        <span className="font-sans font-semibold text-emerald-700 dark:text-emerald-400">
                          {lastScanResult.attendance.status === 'late'
                            ? lang === 'fr'
                              ? 'Retard'
                              : 'Late'
                            : lang === 'fr'
                            ? 'Présent'
                            : 'Present'}
                        </span>
                      </p>
                    </div>
                  </div>
                </SurfaceCard>
              ) : (
                <SurfaceCard className="text-center text-xs text-slate-400">
                  {lang === 'fr'
                    ? 'Aucun élève scanné pour cette session. Scannez une carte scolaire pour afficher la fiche de vérification.'
                    : 'No cards scanned yet in this session.'}
                </SurfaceCard>
              )}

              {/* Session History */}
              <SurfaceCard>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                    {lang === 'fr' ? 'Historique des scans' : 'Scan History'}
                  </h3>
                  <span className="font-mono-tabular text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {scanHistory.length}
                  </span>
                </div>
                <div className="mt-3 max-h-64 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto text-xs">
                  {scanHistory.length === 0 ? (
                    <p className="py-4 text-center text-slate-400">
                      {lang === 'fr' ? 'En attente de scans...' : 'Waiting for scans...'}
                    </p>
                  ) : (
                    scanHistory.map((item, idx) => (
                      <div
                        key={`${item.student.id}-${idx}`}
                        className="flex items-center justify-between py-2.5"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {item.student.firstName} {item.student.lastName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.student.className} ·{' '}
                            <span className="font-mono-tabular">
                              {item.student.registrationNumber}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`font-semibold ${
                              item.attendance.status === 'late'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {item.attendance.status === 'late'
                              ? lang === 'fr'
                                ? 'Retard'
                                : 'Late'
                              : lang === 'fr'
                              ? 'Présent'
                              : 'Present'}
                          </p>
                          <p className="font-mono-tabular text-[11px] text-slate-400">
                            {item.scannedAt}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Mois :</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className={`${inputBaseClass} w-44 font-mono-tabular`}
                />
              </div>

              {report && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportToExcel(
                        report.studentStats,
                        'Présences',
                        `EDUSMART_Presences_${month}`
                      )
                    }
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Excel</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportTableToPdf(
                        `Rapport de Présence — ${month}`,
                        `Synthèse par classe`,
                        ['Classe', 'Présents', 'Absents', 'Retards', 'Excusés', 'Taux %'],
                        report.classStats.map((c: any) => [
                          c.className,
                          c.present,
                          c.absent,
                          c.late,
                          c.excused,
                          `${c.rate}%`,
                        ]),
                        `EDUSMART_Presences_${month}`,
                        school?.name
                      )
                    }
                  >
                    <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
                    <span>PDF</span>
                  </Button>
                </div>
              )}
            </div>
          </SurfaceCard>

          {report && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SurfaceCard>
                <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                  Assiduité par classe ({month})
                </h2>
                <table className="mt-3 w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2">Classe</th>
                      <th className="py-2">Prés.</th>
                      <th className="py-2">Abs.</th>
                      <th className="py-2">Ret.</th>
                      <th className="py-2 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.classStats.map((c: any) => (
                      <tr key={c.classId}>
                        <td className="py-2 font-semibold">{c.className}</td>
                        <td className="py-2 font-mono-tabular text-emerald-700 dark:text-emerald-400">
                          {c.present}
                        </td>
                        <td className="py-2 font-mono-tabular text-red-700 dark:text-red-400">
                          {c.absent}
                        </td>
                        <td className="py-2 font-mono-tabular text-amber-700 dark:text-amber-400">
                          {c.late}
                        </td>
                        <td className="py-2 text-right font-mono-tabular font-bold">{c.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SurfaceCard>

              <SurfaceCard>
                <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                  Détail par élève ({month})
                </h2>
                <table className="mt-3 w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2">Élève</th>
                      <th className="py-2">Prés.</th>
                      <th className="py-2">Abs.</th>
                      <th className="py-2">Ret.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.studentStats.map((s: any) => (
                      <tr key={s.studentId}>
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2 font-mono-tabular text-emerald-700 dark:text-emerald-400">
                          {s.present}
                        </td>
                        <td className="py-2 font-mono-tabular text-red-700 dark:text-red-400">
                          {s.absent}
                        </td>
                        <td className="py-2 font-mono-tabular text-amber-700 dark:text-amber-400">
                          {s.late}
                        </td>
                      </tr>
                    ))}
                    {report.studentStats.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          Aucune donnée sur cette période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SurfaceCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
