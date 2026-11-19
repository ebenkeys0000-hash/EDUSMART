import React, { useEffect, useState } from 'react';
import {
  Download,
  Eye,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  User,
  Users,
  UserCheck,
  CopyCheck,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { ClassCardMeta, exportIdCardsPdf, PrintableIdCard } from '../../lib/exports.ts';
import {
  AlertBanner,
  Button,
  inputBaseClass,
  PageHeader,
  SegmentedTabs,
  SurfaceCard,
  TableSkeleton,
} from '../ui/DesignSystem.tsx';
import { IdCardPreviewModal } from './StudentIdCardModal.tsx';
import { IdCardFrontBack } from './IdCardTemplates.tsx';

interface IdCardRecord {
  id: number;
  cardType: 'student' | 'teacher' | 'class';
  studentId: number | null;
  teacherId: number | null;
  classId: number | null;
  cardNumber: string;
  holderName: string;
  holderCode: string;
  designationOrClass: string;
  academicYearOrStatus: string;
  photoUrl: string;
  verificationCode: string;
  status: 'active' | 'inactive' | 'lost';
  reprintCount: number;
  issuedAt: string;
  lastPrintedAt: string;
  gender?: string;
  dateOfBirth?: string;
  assignedClasses?: string[];
  classMeta?: ClassCardMeta;
}

interface ClassOption {
  id: number;
  name: string;
  nameEn?: string;
}

export const IdCardsModule: React.FC = () => {
  const { lang, school, user } = useAuth();
  const [tab, setTab] = useState<'all' | 'student' | 'teacher' | 'class'>('all');
  const [items, setItems] = useState<IdCardRecord[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    studentCards: 0,
    teacherCards: 0,
    classCards: 0,
    activeCards: 0,
    inactiveCards: 0,
  });
  const [missingCounts, setMissingCounts] = useState({ students: 0, teachers: 0, classes: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkClassId, setBulkClassId] = useState('');
  const [previewCard, setPreviewCard] = useState<IdCardRecord | null>(null);

  const isAdmin = user?.role === 'school_admin' || user?.role === 'super_admin';

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (tab !== 'all') qs.set('cardType', tab);
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (classFilter && tab !== 'teacher') qs.set('classId', classFilter);
      if (search.trim()) qs.set('search', search.trim());

      const [res, acad] = await Promise.all([
        apiRequest<{
          items: IdCardRecord[];
          summary: typeof summary;
          studentsWithoutCard: number;
          teachersWithoutCard: number;
          classesWithoutCard: number;
        }>(`/api/id-cards?${qs.toString()}`),
        apiRequest<{ classes: ClassOption[] }>('/api/academics/structure'),
      ]);

      setItems(res.items || []);
      setSummary({
        total: res.summary.total || 0,
        studentCards: res.summary.studentCards || 0,
        teacherCards: res.summary.teacherCards || 0,
        classCards: res.summary.classCards || 0,
        activeCards: res.summary.activeCards || 0,
        inactiveCards: res.summary.inactiveCards || 0,
      });
      setMissingCounts({
        students: res.studentsWithoutCard || 0,
        teachers: res.teachersWithoutCard || 0,
        classes: res.classesWithoutCard || 0,
      });
      setClassesList(acad.classes || []);
      if (!bulkClassId && acad.classes?.[0]) {
        setBulkClassId(String(acad.classes[0].id));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [tab, statusFilter, classFilter]);

  const toPrintable = (c: IdCardRecord): PrintableIdCard => ({
    cardType: c.cardType,
    cardNumber: c.cardNumber,
    holderName: c.holderName,
    holderCode: c.holderCode,
    designationOrClass: c.designationOrClass,
    academicYearOrStatus: c.academicYearOrStatus,
    photoUrl: c.photoUrl,
    verificationCode: c.verificationCode,
    status: c.status,
    gender: c.gender,
    dateOfBirth: c.dateOfBirth,
    assignedClasses: c.assignedClasses,
    issuedAt: c.issuedAt,
    classMeta: c.classMeta,
  });

  const handleBulkGenerate = async (
    targetType: 'class' | 'all_students' | 'all_teachers' | 'all_classes'
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload =
        targetType === 'class' ? { targetType, classId: Number(bulkClassId) } : { targetType };
      const res = await apiRequest<{ totalCount: number; createdCount: number }>(
        '/api/id-cards/generate',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setNotice(
        lang === 'fr'
          ? `${res.totalCount} carte(s) générée(s) ou synchronisée(s) (${res.createdCount} nouvelle(s)).`
          : `${res.totalCount} ID card(s) generated/synced (${res.createdCount} newly issued).`
      );
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async (card: IdCardRecord) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ card: IdCardRecord }>(`/api/id-cards/${card.id}/regenerate`, {
        method: 'POST',
      });
      setNotice(
        lang === 'fr'
          ? `Nouveau QR code généré pour ${card.holderName}.`
          : `New verification QR code generated for ${card.holderName}.`
      );
      await loadCards();
      if (previewCard?.id === card.id) setPreviewCard(res.card);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReprint = async (card: IdCardRecord) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/id-cards/${card.id}/reprint`, { method: 'POST' });
      if (school) {
        await exportIdCardsPdf([toPrintable(card)], school);
      }
      setNotice(
        lang === 'fr'
          ? `Réimpression enregistrée et PDF téléchargé pour ${card.holderName}.`
          : `Reprint recorded and PDF downloaded for ${card.holderName}.`
      );
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (card: IdCardRecord, nextStatus: 'active' | 'inactive' | 'lost') => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/id-cards/${card.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(
        lang === 'fr'
          ? `Statut de la carte de ${card.holderName} mis à jour : ${nextStatus}.`
          : `Card status updated for ${card.holderName}: ${nextStatus}.`
      );
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBulkExportPdf = async () => {
    if (!school || items.length === 0) return;
    setBusy(true);
    try {
      await exportIdCardsPdf(items.map(toPrintable), school);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print space-y-5">
        <PageHeader
          title={lang === 'fr' ? "Gestion des Cartes d'Identité" : 'ID Card Management'}
          subtitle={
            lang === 'fr'
              ? 'Cartes scolaires élèves, cartes staff enseignants & cartes officielles de classes avec vérification QR sécurisée'
              : 'Student, teacher/staff & class ID cards with secure QR code verification, bulk export & reprinting'
          }
          actions={
            <SegmentedTabs
              value={tab}
              onChange={(val) => {
                setTab(val);
                if (val === 'teacher') setClassFilter('');
              }}
              tabs={[
                { id: 'all', label: lang === 'fr' ? 'Toutes' : 'All Cards' },
                {
                  id: 'student',
                  label: lang === 'fr' ? 'Élèves' : 'Students',
                  icon: <Users className="h-3.5 w-3.5" />,
                },
                {
                  id: 'teacher',
                  label: lang === 'fr' ? 'Enseignants' : 'Teachers',
                  icon: <UserCheck className="h-3.5 w-3.5" />,
                },
                {
                  id: 'class',
                  label: lang === 'fr' ? 'Classes' : 'Classes',
                  icon: <BookOpen className="h-3.5 w-3.5" />,
                },
              ]}
            />
          }
        />

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SurfaceCard padding="sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {lang === 'fr' ? 'Total Cartes' : 'Total ID Cards'}
            </p>
            <p className="mt-1 font-display text-2xl font-bold font-mono-tabular text-[#0F2744] dark:text-white">
              {summary.total}
            </p>
          </SurfaceCard>
          <SurfaceCard padding="sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {lang === 'fr' ? 'Élèves / Enseignants' : 'Students / Teachers'}
            </p>
            <p className="mt-1 font-display text-2xl font-bold font-mono-tabular text-[#1E40AF] dark:text-blue-400">
              {summary.studentCards} <span className="text-slate-300 dark:text-slate-700">/</span>{' '}
              {summary.teacherCards}
            </p>
          </SurfaceCard>
          <SurfaceCard padding="sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {lang === 'fr' ? 'Cartes de Classe' : 'Class ID Cards'}
            </p>
            <p className="mt-1 font-display text-2xl font-bold font-mono-tabular text-sky-700 dark:text-sky-400">
              {summary.classCards}
            </p>
          </SurfaceCard>
          <SurfaceCard padding="sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {lang === 'fr' ? 'Actives / Inactives' : 'Active / Inactive'}
            </p>
            <p className="mt-1 font-display text-2xl font-bold font-mono-tabular">
              <span className="text-emerald-600 dark:text-emerald-400">{summary.activeCards}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-700">/</span>
              <span className="text-slate-500 dark:text-slate-400">{summary.inactiveCards}</span>
            </p>
          </SurfaceCard>
        </div>

        {/* Bulk Generation & Print Toolbar */}
        <SurfaceCard padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                className={`${inputBaseClass} w-44`}
              >
                {classesList.length === 0 && (
                  <option value="">{lang === 'fr' ? 'Aucune classe' : 'No classes'}</option>
                )}
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'en' && c.nameEn ? c.nameEn : c.name}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                disabled={busy || !bulkClassId}
                onClick={() => handleBulkGenerate('class')}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
                <span>
                  {lang === 'fr' ? 'Générer élèves de la classe' : 'Generate Class Students'}
                </span>
              </Button>

              {missingCounts.students > 0 && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleBulkGenerate('all_students')}
                >
                  <span>
                    {lang === 'fr'
                      ? `Sync. Élèves (${missingCounts.students})`
                      : `Sync Students (${missingCounts.students})`}
                  </span>
                </Button>
              )}

              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleBulkGenerate('all_teachers')}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
                    <span>
                      {lang === 'fr'
                        ? `Générer Enseignants${
                            missingCounts.teachers > 0 ? ` (${missingCounts.teachers})` : ''
                          }`
                        : `Generate Teachers${
                            missingCounts.teachers > 0 ? ` (${missingCounts.teachers})` : ''
                          }`}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => handleBulkGenerate('all_classes')}
                  >
                    <BookOpen className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" />
                    <span>
                      {lang === 'fr'
                        ? `Cartes de Classes${
                            missingCounts.classes > 0 ? ` (${missingCounts.classes})` : ''
                          }`
                        : `Class ID Cards${
                            missingCounts.classes > 0 ? ` (${missingCounts.classes})` : ''
                          }`}
                    </span>
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={busy || items.length === 0}
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{lang === 'fr' ? 'Imprimer la liste' : 'Print Sheet'}</span>
              </Button>
              <Button
                variant="primary"
                disabled={busy || items.length === 0}
                onClick={handleBulkExportPdf}
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {lang === 'fr'
                    ? `Exporter PDF (${items.length})`
                    : `Export PDF (${items.length})`}
                </span>
              </Button>
            </div>
          </div>
        </SurfaceCard>

        {/* Search & Filter Bar */}
        <SurfaceCard padding="sm">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCards()}
                placeholder={
                  lang === 'fr'
                    ? 'Rechercher par nom, matricule, code staff ou N° carte...'
                    : 'Search by name, student/teacher ID, or card number...'
                }
                className={`${inputBaseClass} pl-9`}
              />
            </div>

            {tab !== 'teacher' && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className={`${inputBaseClass} sm:w-44`}
              >
                <option value="">{lang === 'fr' ? 'Toutes les classes' : 'All Classes'}</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${inputBaseClass} sm:w-40`}
            >
              <option value="all">{lang === 'fr' ? 'Tous les statuts' : 'All Statuses'}</option>
              <option value="active">{lang === 'fr' ? 'Actives' : 'Active'}</option>
              <option value="inactive">{lang === 'fr' ? 'Inactives' : 'Inactive'}</option>
              <option value="lost">{lang === 'fr' ? 'Perdues' : 'Lost'}</option>
            </select>

            <Button variant="outline" onClick={loadCards}>
              {lang === 'fr' ? 'Rechercher' : 'Search'}
            </Button>
          </div>
        </SurfaceCard>

        {error && <AlertBanner type="error">{error}</AlertBanner>}
        {notice && <AlertBanner type="success">{notice}</AlertBanner>}

        {/* Cards Registry Table */}
        <SurfaceCard padding="none" className="overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-400 space-y-3">
              <p>
                {lang === 'fr'
                  ? "Aucune carte trouvée. Utilisez les boutons ci-dessus pour générer les cartes d'une classe ou du personnel."
                  : 'No ID cards found. Use the controls above to generate cards for a class or all teachers.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Titulaire' : 'Cardholder'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Type & ID' : 'Type & ID'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Classe / Fonction' : 'Class / Role'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Statut & Tirages' : 'Status & Reprints'}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? (
                            <img
                              src={c.photoUrl}
                              alt={c.holderName}
                              className="h-10 w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                              <User className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {c.holderName}
                            </p>
                            <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                              {c.cardNumber} · {c.issuedAt}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {c.cardType === 'class'
                            ? lang === 'fr'
                              ? 'Classe Officielle'
                              : 'Class Card'
                            : c.cardType === 'teacher'
                            ? lang === 'fr'
                              ? 'Enseignant / Staff'
                              : 'Teacher / Staff'
                            : lang === 'fr'
                            ? 'Élève'
                            : 'Student'}
                        </p>
                        <p className="font-mono-tabular text-[11px] font-semibold text-[#1E40AF] dark:text-blue-400">
                          {c.holderCode}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {c.designationOrClass || '—'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {c.academicYearOrStatus}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className={`font-semibold capitalize ${
                            c.status === 'active'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : c.status === 'lost'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {c.status === 'active'
                            ? lang === 'fr'
                              ? 'Active'
                              : 'Active'
                            : c.status === 'lost'
                            ? lang === 'fr'
                              ? 'Perdue'
                              : 'Lost'
                            : lang === 'fr'
                            ? 'Inactive'
                            : 'Inactive'}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-400">
                          {lang === 'fr' ? 'Réimpressions : ' : 'Reprints: '}
                          {c.reprintCount}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewCard(c)}
                            title={lang === 'fr' ? 'Aperçu Recto / Verso' : 'Preview Card'}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReprint(c)}
                            title={
                              lang === 'fr'
                                ? 'Réimprimer / Télécharger PDF (carte perdue)'
                                : 'Reprint / Download PDF'
                            }
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0F2744] dark:hover:text-white cursor-pointer"
                          >
                            <CopyCheck className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRegenerate(c)}
                                title={
                                  lang === 'fr'
                                    ? 'Régénérer un nouveau QR code'
                                    : 'Regenerate QR Card'
                                }
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] cursor-pointer"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(
                                    c,
                                    c.status === 'active' ? 'inactive' : 'active'
                                  )
                                }
                                title={
                                  c.status === 'active'
                                    ? lang === 'fr'
                                      ? 'Désactiver la carte'
                                      : 'Mark Inactive'
                                    : lang === 'fr'
                                    ? 'Réactiver la carte'
                                    : 'Mark Active'
                                }
                                className={`rounded-lg p-1.5 cursor-pointer ${
                                  c.status === 'active'
                                    ? 'text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600'
                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                }`}
                              >
                                {c.status === 'active' ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* Print-Only Sheet when printing all filtered cards */}
      {school && items.length > 0 && !previewCard && (
        <div className="hidden print:block space-y-6">
          <h1 className="text-lg font-bold text-[#0F2744]">
            {school.name} — Planche Cartes Officielles ({items.length})
          </h1>
          <div className="space-y-6">
            {items.map((c) => (
              <div key={c.id} className="break-inside-avoid">
                <IdCardFrontBack card={toPrintable(c)} school={school} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {previewCard && school && (
        <IdCardPreviewModal
          card={toPrintable(previewCard)}
          school={school}
          onClose={() => setPreviewCard(null)}
          onRecordedPrint={() => {
            apiRequest(`/api/id-cards/${previewCard.id}/reprint`, { method: 'POST' })
              .then(() => loadCards())
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
};
