import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  User,
  ArrowLeft,
  Building2,
  Calendar,
  BadgeCheck,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Button } from './ui/DesignSystem.tsx';
import { BrandLogo } from './ui/BrandLogo.tsx';

interface VerificationPayload {
  valid: boolean;
  error?: string;
  card?: {
    cardType: 'student' | 'teacher' | 'class';
    cardNumber: string;
    fullName: string;
    uniqueId: string;
    designationOrClass: string;
    academicYearOrStatus: string;
    photoUrl: string;
    status: 'active' | 'inactive' | 'lost';
    issuedAt: string;
    classMeta?: {
      classNameFr?: string;
      classNameEn?: string;
      level?: string;
      room?: string;
      capacity?: number;
      studentCount?: number;
      teacherName?: string;
      seriesName?: string;
      specializationName?: string;
    };
  };
  school?: {
    name: string;
    code: string;
    city: string;
    country: string;
    logoUrl: string;
    phone: string;
  } | null;
}

export const IdCardVerificationPage: React.FC<{
  verificationCode: string;
  onExit: () => void;
}> = ({ verificationCode, onExit }) => {
  const { lang } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationPayload | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/id-cards/verify/${encodeURIComponent(verificationCode)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (active) setData(json);
      })
      .catch(() => {
        if (active) {
          setData({
            valid: false,
            error:
              lang === 'fr'
                ? 'Impossible de contacter le serveur de vérification.'
                : 'Unable to reach verification server.',
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [verificationCode, lang]);

  const card = data?.card;
  const school = data?.school;
  const isValidActive = Boolean(data?.valid && card?.status === 'active');

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <p className="font-display text-sm font-bold tracking-tight text-[#082F5E] dark:text-white leading-tight">
                EduSmart
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'fr'
                  ? "Vérification Officielle de Carte d'Identité"
                  : 'Official ID Card Verification'}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onExit}>
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{lang === 'fr' ? 'Retour EDUSMART' : 'Back to EDUSMART'}</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-xl">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
              {lang === 'fr'
                ? 'Vérification cryptographique de la carte en cours...'
                : 'Verifying ID card authenticity...'}
            </div>
          ) : !card ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h1 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                {lang === 'fr' ? 'Carte non reconnue' : 'Unrecognized ID Card'}
              </h1>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {data?.error ||
                  (lang === 'fr'
                    ? 'Ce QR code ne correspond à aucune carte officielle active.'
                    : 'This QR code does not match any registered official ID card.')}
              </p>
              <p className="mt-3 font-mono-tabular text-[11px] text-slate-400">
                {verificationCode}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              {/* Status Banner */}
              <div
                className={`flex items-center justify-between px-6 py-4 text-white ${
                  isValidActive
                    ? 'bg-emerald-600 dark:bg-emerald-700'
                    : 'bg-red-600 dark:bg-red-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isValidActive ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-6 w-6 shrink-0" />
                  )}
                  <div>
                    <p className="font-display text-sm font-bold tracking-wide uppercase">
                      {isValidActive
                        ? lang === 'fr'
                          ? 'Identité Vérifiée · Carte Active'
                          : 'Identity Verified · Active Card'
                        : card.status === 'lost'
                        ? lang === 'fr'
                          ? 'Alerte : Carte Déclarée Perdue'
                          : 'Warning: Card Reported Lost'
                        : lang === 'fr'
                        ? 'Carte Inactive / Désactivée'
                        : 'Card Inactive / Deactivated'}
                    </p>
                    <p className="text-[11px] text-white/85">
                      {card.cardType === 'class'
                        ? lang === 'fr'
                          ? 'Classe Officielle Enregistrée'
                          : 'Officially Registered Class'
                        : card.cardType === 'teacher'
                        ? lang === 'fr'
                          ? 'Personnel Enseignant Officiel'
                          : 'Official Teaching Staff'
                        : lang === 'fr'
                        ? 'Élève Officiellement Inscrit'
                        : 'Officially Enrolled Student'}
                    </p>
                  </div>
                </div>
                <span className="font-mono-tabular text-xs font-bold">{card.cardNumber}</span>
              </div>

              {/* School Header */}
              {school && (
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-3.5 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    {school.logoUrl ? (
                      <img
                        src={school.logoUrl}
                        alt={school.name}
                        className="h-9 w-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F2744] text-white">
                        <Building2 className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#0F2744] dark:text-white">
                        {school.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {[school.city, school.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-[11px] font-semibold text-slate-500 shrink-0">
                    {school.code}
                  </span>
                </div>
              )}

              {/* Verified Safe Identity Block (No Sensitive PII) */}
              <div className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {card.cardType === 'class' ? (
                      school?.logoUrl ? (
                        <img
                          src={school.logoUrl}
                          alt={card.fullName}
                          className="h-20 w-20 rounded-xl object-cover"
                        />
                      ) : (
                        <BookOpen className="h-10 w-10 text-[#0F2744] dark:text-blue-400" />
                      )
                    ) : card.photoUrl ? (
                      <img
                        src={card.photoUrl}
                        alt={card.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">
                        {card.cardType === 'class'
                          ? lang === 'fr'
                            ? 'Classe Officielle'
                            : 'Official Class'
                          : lang === 'fr'
                          ? 'Titulaire de la carte'
                          : 'Cardholder'}
                      </p>
                      <h1 className="font-display text-2xl font-bold text-[#0F2744] dark:text-white">
                        {card.cardType === 'class' && card.classMeta
                          ? lang === 'en'
                            ? card.classMeta.classNameEn || card.fullName
                            : card.classMeta.classNameFr || card.fullName
                          : card.fullName}
                      </h1>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {card.cardType === 'class'
                            ? lang === 'fr'
                              ? 'N° Classe'
                              : 'Class ID'
                            : card.cardType === 'teacher'
                            ? lang === 'fr'
                              ? 'Code Enseignant'
                              : 'Teacher ID'
                            : lang === 'fr'
                            ? 'Matricule Élève'
                            : 'Student ID'}
                        </p>
                        <p className="mt-0.5 font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                          {card.uniqueId}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {card.cardType === 'class'
                            ? lang === 'fr'
                              ? 'Professeur Titulaire'
                              : 'Class Teacher'
                            : card.cardType === 'teacher'
                            ? lang === 'fr'
                              ? 'Fonction / Discipline'
                              : 'Designation'
                            : lang === 'fr'
                            ? 'Classe'
                            : 'Class'}
                        </p>
                        <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                          {card.cardType === 'class'
                            ? card.classMeta?.teacherName || '—'
                            : card.designationOrClass || '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {card.cardType === 'class'
                            ? lang === 'fr'
                              ? 'Année & Effectif'
                              : 'Year & Enrollment'
                            : card.cardType === 'teacher'
                            ? lang === 'fr'
                              ? 'Statut Emploi'
                              : 'Employment Status'
                            : lang === 'fr'
                            ? 'Année Académique'
                            : 'Academic Year'}
                        </p>
                        <p className="mt-0.5 font-semibold text-slate-900 dark:text-white font-mono-tabular">
                          {card.cardType === 'class'
                            ? `${card.academicYearOrStatus} · ${card.classMeta?.studentCount ?? 0} ${
                                lang === 'fr' ? 'élèves' : 'students'
                              }`
                            : card.academicYearOrStatus || '—'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400">
                          {lang === 'fr' ? 'Date d’émission' : 'Issued Date'}
                        </p>
                        <p className="mt-0.5 font-mono-tabular font-semibold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{card.issuedAt || '—'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-[#1E40AF] dark:text-blue-400" />
                    <span>
                      {lang === 'fr'
                        ? 'Données confidentielles protégées (RGPD / Protection scolaire)'
                        : 'Sensitive personal details protected by privacy policy'}
                    </span>
                  </span>
                  {school?.phone && <span className="font-mono-tabular">{school.phone}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
