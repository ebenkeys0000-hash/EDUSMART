import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BookOpen, QrCode, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import {
  buildCardVerificationUrl,
  IdCardSchoolInfo,
  PrintableIdCard,
} from '../../lib/exports.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { BrandLogo } from '../ui/BrandLogo.tsx';

export const IdCardFrontBack: React.FC<{
  card: PrintableIdCard;
  school: IdCardSchoolInfo;
  compact?: boolean;
}> = ({ card, school, compact = false }) => {
  const { lang } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState('');

  const isTeacher = card.cardType === 'teacher';
  const isClass = card.cardType === 'class';
  const qrUrl = buildCardVerificationUrl(
    card.verificationCode,
    `EDUSMART:${school.code}:${card.holderCode}`
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrUrl, {
      width: 260,
      margin: 1,
      color: { dark: '#0F2744', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [qrUrl]);

  const isInactive = card.status === 'inactive' || card.status === 'lost';
  const schoolLocation = [school.city, school.country].filter(Boolean).join(', ') || school.code;
  const classMeta = card.classMeta || {};

  return (
    <div className={`grid grid-cols-1 ${compact ? 'gap-3 sm:grid-cols-2' : 'gap-6 md:grid-cols-2'}`}>
      {/* RECTO (FRONT) */}
      <div>
        {!compact && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {lang === 'fr'
              ? isClass
                ? 'Recto — Carte Officielle de Classe'
                : isTeacher
                ? 'Recto — Identité & Fonction Enseignant'
                : 'Recto — Identité & Classe Élève'
              : isClass
              ? 'Front — Official Class Identification Card'
              : isTeacher
              ? 'Front — Staff Identity & Role'
              : 'Front — Student Identity & Class'}
          </p>
        )}

        <div className="relative overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-white shadow-sm text-slate-900">
          {isInactive && (
            <div className="absolute right-3 top-14 z-10 rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
              {card.status === 'lost'
                ? lang === 'fr'
                  ? 'Perdue'
                  : 'Lost'
                : lang === 'fr'
                ? 'Inactive'
                : 'Inactive'}
            </div>
          )}

          {/* Header Band: Distinct Navy for Students, Royal Blue for Teachers, Sky-Navy Blue for Class */}
          <div
            className={`flex items-center justify-between px-4 py-3 text-white ${
              isClass ? 'bg-[#0369A1]' : isTeacher ? 'bg-[#1E40AF]' : 'bg-[#0F2744]'
            }`}
          >
            <div className="min-w-0 pr-2">
              <p className="truncate text-xs font-bold tracking-wide uppercase">{school.name}</p>
              <p className="text-[10px] text-blue-100">
                {isClass
                  ? lang === 'fr'
                    ? 'CARTE OFFICIELLE DE CLASSE'
                    : 'OFFICIAL CLASS ID CARD'
                  : isTeacher
                  ? lang === 'fr'
                    ? 'CARTE PERSONNEL ENSEIGNANT'
                    : 'TEACHER / STAFF ID CARD'
                  : lang === 'fr'
                  ? 'CARTE SCOLAIRE ÉLÈVE'
                  : 'STUDENT ID CARD'}{' '}
                · {card.academicYearOrStatus}
              </p>
            </div>
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt={school.name}
                className="h-9 w-9 rounded-lg object-cover border border-white/25 bg-white shrink-0"
              />
            ) : (
              <BrandLogo size="xs" />
            )}
          </div>

          {isClass ? (
            <div className="flex items-start gap-4 p-4">
              <div className="h-28 w-22 shrink-0 overflow-hidden rounded-lg border border-sky-200 bg-sky-50 flex flex-col items-center justify-center p-2 text-center">
                {school.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt={school.name}
                    className="h-14 w-14 rounded-lg object-cover border border-sky-200 bg-white"
                  />
                ) : (
                  <BookOpen className="h-8 w-8 text-[#0F2744]" />
                )}
                <span className="mt-1.5 font-mono-tabular text-[10px] font-bold text-[#0F2744]">
                  {card.holderCode}
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'fr' ? 'Classe (FR / EN)' : 'Class Name (FR / EN)'}
                  </p>
                  <p className="truncate font-display text-sm font-bold text-[#0F2744]">
                    {classMeta.classNameFr || card.holderName}
                    {classMeta.classNameEn && classMeta.classNameEn !== classMeta.classNameFr
                      ? ` · ${classMeta.classNameEn}`
                      : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {lang === 'fr' ? 'Professeur Titulaire' : 'Class Teacher'}
                    </p>
                    <p className="truncate font-semibold text-[#1E40AF]">
                      {classMeta.teacherName || 'Non assigné'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {lang === 'fr' ? 'Effectif Inscrits' : 'Enrolled Students'}
                    </p>
                    <p className="font-mono-tabular font-bold text-[#0F2744]">
                      {classMeta.studentCount ?? 0} / {classMeta.capacity ?? 40}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="truncate">
                    <span className="text-slate-400">{lang === 'fr' ? 'Niveau : ' : 'Level: '}</span>
                    <span className="font-medium text-slate-800">{classMeta.level || '—'}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400">{lang === 'fr' ? 'Salle : ' : 'Room: '}</span>
                    <span className="font-mono-tabular">{classMeta.room || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 p-4">
              <div className="h-28 w-22 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                {card.photoUrl ? (
                  <img
                    src={card.photoUrl}
                    alt={card.holderName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <User className="h-8 w-8" />
                    <span className="mt-1 text-[9px] font-semibold uppercase">Photo</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {lang === 'fr' ? 'Nom Complet' : 'Full Name'}
                  </p>
                  <p className="truncate font-display text-sm font-bold text-slate-900">
                    {card.holderName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {isTeacher
                        ? lang === 'fr'
                          ? 'Fonction / Matière'
                          : 'Designation'
                        : lang === 'fr'
                        ? 'Classe'
                        : 'Class'}
                    </p>
                    <p className="truncate font-semibold text-[#1E40AF]">
                      {card.designationOrClass || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {isTeacher
                        ? lang === 'fr'
                          ? 'Code Staff'
                          : 'Staff ID'
                        : lang === 'fr'
                        ? 'Matricule'
                        : 'Student ID'}
                    </p>
                    <p className="font-mono-tabular font-bold text-[#0F2744] truncate">
                      {card.holderCode}
                    </p>
                  </div>
                </div>

                {isTeacher ? (
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p className="truncate">
                      <span className="text-slate-400">
                        {lang === 'fr' ? 'Classes : ' : 'Classes: '}
                      </span>
                      <span className="font-medium text-slate-800">
                        {card.assignedClasses && card.assignedClasses.length > 0
                          ? card.assignedClasses.join(', ')
                          : lang === 'fr'
                          ? 'Équipe pédagogique'
                          : 'Academic Faculty'}
                      </span>
                    </p>
                    <p className="truncate">
                      <span className="text-slate-400">
                        {lang === 'fr' ? 'Statut : ' : 'Status: '}
                      </span>
                      <span className="font-medium text-emerald-700">
                        {card.academicYearOrStatus || 'Actif'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400">{lang === 'fr' ? 'Né(e) : ' : 'DOB: '}</span>
                      <span className="font-mono-tabular">{card.dateOfBirth || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">
                        {lang === 'fr' ? 'Année : ' : 'Year: '}
                      </span>
                      <span className="font-mono-tabular">
                        {card.academicYearOrStatus || '2026-2027'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
            <span className="truncate">{schoolLocation}</span>
            <span className="font-mono-tabular font-bold tracking-wider text-[#0F2744]">
              {card.cardNumber || card.holderCode} · RECTO
            </span>
          </div>
        </div>
      </div>

      {/* VERSO (BACK) */}
      <div>
        {!compact && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {lang === 'fr'
              ? 'Verso — QR Code de Vérification Sécurisée'
              : 'Back — Secure Verification QR Code'}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 shadow-sm text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
            <span className="text-[11px] font-bold tracking-wide text-[#0F2744] uppercase">
              {isClass
                ? lang === 'fr'
                  ? 'Vérification Officielle de Classe'
                  : 'Official Class Verification'
                : isTeacher
                ? lang === 'fr'
                  ? 'Accréditation & Vérification Staff'
                  : 'Staff Accreditation & Verification'
                : lang === 'fr'
                ? 'Vérification Identité & Présence'
                : 'Identity & Attendance Verification'}
            </span>
            {isInactive ? (
              <ShieldAlert className="h-4 w-4 text-red-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            )}
          </div>

          <div className="flex items-center gap-4 p-4">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code Vérification" className="h-full w-full object-contain" />
              ) : (
                <QrCode className="h-12 w-12 text-slate-300" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2 text-[11px] text-slate-600">
              <p className="font-medium leading-snug text-slate-700">
                {lang === 'fr'
                  ? "Scannez ce QR code pour vérifier l'authenticité et le statut actif de la carte sans exposer de données privées."
                  : 'Scan this QR code to verify card authenticity and active status without exposing confidential personal details.'}
              </p>
              <div className="space-y-0.5 border-t border-slate-200 pt-2">
                <p className="truncate font-mono-tabular">
                  <span className="font-sans font-semibold text-slate-800">
                    {lang === 'fr' ? 'Tél École : ' : 'School Tel: '}
                  </span>
                  {school.phone || '—'}
                </p>
                <p className="truncate">
                  <span className="font-semibold text-slate-800">
                    {lang === 'fr' ? 'Lieu : ' : 'Location: '}
                  </span>
                  {schoolLocation}
                </p>
                {school.email && (
                  <p className="truncate">
                    <span className="font-semibold text-slate-800">Email : </span>
                    {school.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[10px] text-slate-500">
            <span className="font-mono-tabular truncate">
              {card.verificationCode || card.holderCode}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <BrandLogo size="xs" framed={false} />
              <span className="font-bold tracking-wider text-[#082F5E]">VERSO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
