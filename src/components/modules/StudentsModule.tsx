import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Archive,
  Trash2,
  Download,
  FileSpreadsheet,
  User,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import {
  exportStudentIdCardsPdf,
  exportTableToPdf,
  exportToExcel,
  IdCardStudent,
} from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { localizeName } from '../../lib/africanCurriculumCatalog.ts';
import { StudentIdCardModal } from './StudentIdCardModal.tsx';
import { PhotoCaptureCropper } from '../ui/PhotoCaptureCropper.tsx';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
  ModalDialog,
  TableSkeleton,
} from '../ui/DesignSystem.tsx';

interface StudentRow {
  id: number;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  placeOfBirth: string;
  address: string;
  photoUrl: string;
  classId: number | null;
  className: string;
  academicYearId?: number | null;
  academicYearName?: string;
  idCard?: {
    cardNumber: string;
    verificationCode: string;
    status: string;
  } | null;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  emergencyContact: string;
  academicHistory: string;
  enrollmentDate: string;
  status: string;
}

interface ClassOption {
  id: number;
  name: string;
  nameEn?: string;
}

interface AcademicYearOption {
  id: number;
  name: string;
  isCurrent: boolean;
}

export const StudentsModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [items, setItems] = useState<StudentRow[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [yearsList, setYearsList] = useState<AcademicYearOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'M',
    dateOfBirth: '',
    placeOfBirth: '',
    address: '',
    photoUrl: '',
    classId: '',
    academicYearId: '',
    academicYearName: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    emergencyContact: '',
    academicHistory: '',
    status: 'active',
  });

  // Profile modal
  const [profileData, setProfileData] = useState<any | null>(null);
  // ID Card modal
  const [idCardStudent, setIdCardStudent] = useState<IdCardStudent | null>(null);
  const [exportingCards, setExportingCards] = useState(false);
  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: '12',
        status: statusFilter,
      });
      if (search) qs.set('search', search);
      if (classFilter) qs.set('classId', classFilter);

      const [res, acad] = await Promise.all([
        apiRequest<{ items: StudentRow[]; total: number; totalPages: number }>(
          `/api/students?${qs.toString()}`
        ),
        apiRequest<{ classes: ClassOption[]; academicYears: AcademicYearOption[] }>(
          '/api/academics/structure'
        ),
      ]);
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setClassesList(acad.classes || []);
      setYearsList(acad.academicYears || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [page, classFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    const currentYear = yearsList.find((y) => y.isCurrent) || yearsList[0];
    setForm({
      firstName: '',
      lastName: '',
      gender: 'M',
      dateOfBirth: '',
      placeOfBirth: '',
      address: '',
      photoUrl: '',
      classId: classesList[0] ? String(classesList[0].id) : '',
      academicYearId: currentYear ? String(currentYear.id) : '',
      academicYearName: currentYear?.name || '2026-2027',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      emergencyContact: '',
      academicHistory: '',
      status: 'active',
    });
    setShowForm(true);
  };

  const openEdit = (s: StudentRow) => {
    setEditing(s);
    setFormError(null);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth || '',
      placeOfBirth: s.placeOfBirth || '',
      address: s.address || '',
      photoUrl: s.photoUrl || '',
      classId: s.classId ? String(s.classId) : '',
      academicYearId: s.academicYearId ? String(s.academicYearId) : '',
      academicYearName: s.academicYearName || '2026-2027',
      parentName: s.parentName || '',
      parentPhone: s.parentPhone || '',
      parentEmail: s.parentEmail || '',
      emergencyContact: s.emergencyContact || '',
      academicHistory: s.academicHistory || '',
      status: s.status || 'active',
    });
    setShowForm(true);
  };

  const toCardStudent = (s: StudentRow): IdCardStudent => ({
    registrationNumber: s.registrationNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    gender: s.gender,
    dateOfBirth: s.dateOfBirth,
    className: s.className,
    photoUrl: s.photoUrl,
    academicYearName: s.academicYearName || '2026-2027',
    verificationCode: s.idCard?.verificationCode,
    cardNumber: s.idCard?.cardNumber,
    parentName: s.parentName,
    parentPhone: s.parentPhone,
    emergencyContact: s.emergencyContact,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.photoUrl.trim()) {
      setFormError(
        lang === 'fr'
          ? "La photo d'identité de l'élève est obligatoire pour l'inscription et la génération automatique de la carte scolaire."
          : 'Student photograph is mandatory for registration and automatic ID card generation.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const selectedYear = yearsList.find((y) => String(y.id) === String(form.academicYearId));
      const payload = {
        ...form,
        classId: form.classId ? Number(form.classId) : null,
        academicYearId: form.academicYearId ? Number(form.academicYearId) : null,
        academicYearName: selectedYear?.name || form.academicYearName || '2026-2027',
      };
      let newlyCreatedCard: IdCardStudent | null = null;
      if (editing) {
        await apiRequest(`/api/students/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const res = await apiRequest<{
          student: StudentRow;
          idCard?: { cardNumber: string; verificationCode: string };
        }>('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const assignedClass = classesList.find((c) => c.id === Number(form.classId));
        newlyCreatedCard = {
          ...res.student,
          className: assignedClass?.name || res.student.className || (lang === 'fr' ? 'Non assigné' : 'Unassigned'),
          academicYearName: res.student.academicYearName || payload.academicYearName,
          verificationCode: res.idCard?.verificationCode || res.student.idCard?.verificationCode,
          cardNumber: res.idCard?.cardNumber || res.student.idCard?.cardNumber,
        };
      }
      setShowForm(false);
      await loadStudents();
      if (newlyCreatedCard) {
        setIdCardStudent(newlyCreatedCard);
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProfile = async (id: number) => {
    try {
      const data = await apiRequest(`/api/students/${id}`);
      setProfileData(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArchiveOrDelete = async (permanent: boolean) => {
    if (!confirmDelete) return;
    try {
      await apiRequest(`/api/students/${confirmDelete.id}?permanent=${permanent}`, {
        method: 'DELETE',
      });
      setConfirmDelete(null);
      await loadStudents();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Gestion des élèves' : 'Student Management'}
        subtitle={
          <>
            <span className="font-mono-tabular font-semibold">{total}</span>{' '}
            {lang === 'fr' ? 'élèves correspondants' : 'matching students'}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  items.map((s) => ({
                    Matricule: s.registrationNumber,
                    Nom: s.lastName,
                    Prénom: s.firstName,
                    Genre: s.gender,
                    Classe: s.className,
                    Parent: s.parentName,
                    Téléphone: s.parentPhone,
                    Statut: s.status,
                  })),
                  'Élèves',
                  'EDUSMART_Liste_Eleves'
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
                  'Liste des Élèves',
                  `${total} élèves`,
                  ['Matricule', 'Nom complet', 'Genre', 'Classe', 'Parent / Tuteur', 'Téléphone'],
                  items.map((s) => [
                    s.registrationNumber,
                    `${s.firstName} ${s.lastName}`,
                    s.gender,
                    s.className,
                    s.parentName || '—',
                    s.parentPhone || '—',
                  ]),
                  'EDUSMART_Liste_Eleves',
                  school?.name
                )
              }
            >
              <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <span>PDF</span>
            </Button>

            <Button
              variant="outline"
              disabled={exportingCards || items.length === 0 || !school}
              onClick={async () => {
                if (!school || items.length === 0) return;
                setExportingCards(true);
                try {
                  await exportStudentIdCardsPdf(items.map(toCardStudent), school);
                } finally {
                  setExportingCards(false);
                }
              }}
            >
              <CreditCard className="h-4 w-4 text-[#1E40AF] dark:text-blue-400" />
              <span>
                {exportingCards
                  ? '...'
                  : lang === 'fr'
                  ? 'Cartes PDF'
                  : 'ID Cards PDF'}
              </span>
            </Button>

            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Nouvel élève' : 'Add Student'}</span>
            </Button>
          </>
        }
      />

      {/* Filter Bar */}
      <SurfaceCard padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStudents()}
              placeholder={
                lang === 'fr'
                  ? 'Rechercher par nom, matricule ou parent...'
                  : 'Search by name, ID, or parent...'
              }
              className={`${inputBaseClass} pl-9`}
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => {
              setPage(1);
              setClassFilter(e.target.value);
            }}
            className={`${inputBaseClass} sm:w-48`}
          >
            <option value="">{lang === 'fr' ? 'Toutes les classes' : 'All Classes'}</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>
                {localizeName(lang, c.name, c.nameEn)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className={`${inputBaseClass} sm:w-40`}
          >
            <option value="active">{lang === 'fr' ? 'Actifs' : 'Active'}</option>
            <option value="archived">{lang === 'fr' ? 'Archivés' : 'Archived'}</option>
            <option value="all">{lang === 'fr' ? 'Tous les statuts' : 'All Statuses'}</option>
          </select>

          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              loadStudents();
            }}
          >
            {lang === 'fr' ? 'Filtrer' : 'Apply'}
          </Button>
        </div>
      </SurfaceCard>

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      {/* Desktop Table & Mobile Cards */}
      <SurfaceCard padding="none" className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-slate-400">
            {lang === 'fr'
              ? 'Aucun élève enregistré. Cliquez sur "Nouvel élève" pour commencer.'
              : 'No students found. Click "Add Student" to register one.'}
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
              {items.map((s) => (
                <div key={s.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {s.photoUrl ? (
                        <img
                          src={s.photoUrl}
                          alt={s.firstName}
                          className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          <User className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-[#1E40AF] dark:text-blue-400">
                          {s.registrationNumber} · {s.className}
                        </p>
                      </div>
                    </div>
                    <span className="capitalize text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate">
                      {s.parentName || '—'} · {s.parentPhone || '—'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIdCardStudent(toCardStudent(s))}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] cursor-pointer"
                      >
                        <CreditCard className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(s.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({ id: s.id, name: `${s.firstName} ${s.lastName}` })
                        }
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Élève' : 'Student'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Matricule' : 'Reg. No.'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Classe' : 'Class'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Parent / Tuteur' : 'Guardian'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Statut' : 'Status'}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {s.photoUrl ? (
                            <img
                              src={s.photoUrl}
                              alt={s.firstName}
                              className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                              <User className="h-4 w-4" />
                            </span>
                          )}
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {s.firstName} {s.lastName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {s.gender === 'F' ? 'Féminin' : 'Masculin'} ·{' '}
                              <span className="font-mono-tabular">{s.dateOfBirth || '—'}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                        {s.registrationNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                        {s.className}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 dark:text-slate-200">{s.parentName || '—'}</p>
                        <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                          {s.parentPhone}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium capitalize text-slate-700 dark:text-slate-300">
                        {s.status}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setIdCardStudent(toCardStudent(s))}
                            title={
                              lang === 'fr' ? 'Carte Scolaire (Recto / Verso)' : 'School ID Card'
                            }
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] dark:hover:text-blue-400 cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(s.id)}
                            title="Voir profil"
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0F2744] dark:hover:text-white cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            title="Modifier"
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] dark:hover:text-blue-400 cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({ id: s.id, name: `${s.firstName} ${s.lastName}` })
                            }
                            title="Archiver / Supprimer"
                            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-xs">
            <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
              Page {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {lang === 'fr' ? 'Précédent' : 'Prev'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {lang === 'fr' ? 'Suivant' : 'Next'}
              </Button>
            </div>
          </div>
        )}
      </SurfaceCard>

      {/* Add/Edit Student Modal */}
      <ModalDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        title={
          editing
            ? lang === 'fr'
              ? 'Modifier la fiche élève'
              : 'Edit Student'
            : lang === 'fr'
            ? 'Inscrire un nouvel élève'
            : 'Register New Student'
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && <AlertBanner type="error">{formError}</AlertBanner>}

          <PhotoCaptureCropper
            value={form.photoUrl}
            onChange={(url) => {
              setForm((prev) => ({ ...prev, photoUrl: url }));
              setFormError(null);
            }}
            ownerType="student"
            required
            label={lang === 'fr' ? "Photo d'identité de l'élève" : 'Student Photograph'}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Prénom *' : 'First Name *'}
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom *' : 'Last Name *'}
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Genre' : 'Gender'}
              </label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Date de naissance' : 'Date of Birth'}
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Classe assignée' : 'Assigned Class'}
              </label>
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Non assigné' : 'Unassigned'}</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localizeName(lang, c.name, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Année académique' : 'Academic Year'}
              </label>
              {yearsList.length > 0 ? (
                <select
                  value={form.academicYearId}
                  onChange={(e) => {
                    const matched = yearsList.find((y) => String(y.id) === e.target.value);
                    setForm({
                      ...form,
                      academicYearId: e.target.value,
                      academicYearName: matched?.name || form.academicYearName,
                    });
                  }}
                  className={`mt-1 ${inputBaseClass}`}
                >
                  {yearsList.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.academicYearName}
                  onChange={(e) => setForm({ ...form, academicYearName: e.target.value })}
                  placeholder="2026-2027"
                  className={`mt-1 ${inputBaseClass}`}
                />
              )}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'fr' ? 'Adresse domicile' : 'Home Address'}
            </label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`mt-1 ${inputBaseClass}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom du parent / tuteur' : 'Parent / Guardian Name'}
              </label>
              <input
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Téléphone du parent' : 'Parent Phone'}
              </label>
              <input
                value={form.parentPhone}
                onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Email du parent
              </label>
              <input
                type="email"
                value={form.parentEmail}
                onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Contact d’urgence' : 'Emergency Contact'}
              </label>
              <input
                value={form.emergencyContact}
                onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'fr' ? 'Parcours académique antérieur' : 'Academic History'}
            </label>
            <textarea
              rows={2}
              value={form.academicHistory}
              onChange={(e) => setForm({ ...form, academicHistory: e.target.value })}
              className={`mt-1 ${inputBaseClass}`}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={saving} variant="primary">
              {saving
                ? lang === 'fr'
                  ? 'Enregistrement...'
                  : 'Saving...'
                : lang === 'fr'
                ? 'Enregistrer'
                : 'Save Student'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Student Profile Modal */}
      <ModalDialog open={!!profileData} onClose={() => setProfileData(null)}>
        {profileData && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 pr-8">
              <div className="flex items-center gap-4">
                {profileData.student.photoUrl ? (
                  <img
                    src={profileData.student.photoUrl}
                    alt={profileData.student.firstName}
                    className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <User className="h-7 w-7" />
                  </span>
                )}
                <div>
                  <h2 className="font-display text-xl font-bold text-[#0F2744] dark:text-white">
                    {profileData.student.firstName} {profileData.student.lastName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                      {profileData.student.registrationNumber}
                    </span>{' '}
                    · {profileData.student.className} · {profileData.student.status}
                  </p>
                </div>
              </div>
              <Button variant="primary" onClick={() => setIdCardStudent(toCardStudent(profileData.student))}>
                <CreditCard className="h-4 w-4" />
                <span>{lang === 'fr' ? 'Carte Scolaire' : 'ID Card'}</span>
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3.5">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  Informations familiales
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Parent : {profileData.student.parentName || '—'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Tél : {profileData.student.parentPhone || '—'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Urgence : {profileData.student.emergencyContact || '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3.5">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  Historique & Coordonnées
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Né(e) le : {profileData.student.dateOfBirth || '—'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Adresse : {profileData.student.address || '—'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Parcours : {profileData.student.academicHistory || '—'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <h3 className="font-bold text-[#0F2744] dark:text-white">
                  Factures ({profileData.invoices.length})
                </h3>
                <div className="mt-2 space-y-2">
                  {profileData.invoices.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-2.5"
                    >
                      <span>{inv.title}</span>
                      <span className="font-mono-tabular font-semibold">
                        {formatCurrency(inv.paidAmount, school?.currency)} /{' '}
                        {formatCurrency(inv.totalAmount, school?.currency)}
                      </span>
                    </div>
                  ))}
                  {profileData.invoices.length === 0 && (
                    <p className="text-slate-400">Aucune facture.</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-[#0F2744] dark:text-white">
                  Présences récentes ({profileData.attendance.length})
                </h3>
                <div className="mt-2 space-y-1.5">
                  {profileData.attendance.slice(0, 5).map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5"
                    >
                      <span className="font-mono-tabular">{a.date}</span>
                      <span className="font-semibold capitalize">{a.status}</span>
                    </div>
                  ))}
                  {profileData.attendance.length === 0 && (
                    <p className="text-slate-400">Aucun appel enregistré.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Confirmation Dialog */}
      <ModalDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        maxWidth="max-w-md"
        title={lang === 'fr' ? 'Archiver ou supprimer ?' : 'Archive or Delete Student?'}
      >
        {confirmDelete && (
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {confirmDelete.name} —{' '}
              {lang === 'fr'
                ? 'Vous pouvez archiver le dossier pour conserver l’historique financier et académique, ou supprimer définitivement.'
                : 'You can archive the student to preserve historical records, or permanently delete.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2.5 text-xs">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <button
                type="button"
                onClick={() => handleArchiveOrDelete(false)}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3.5 py-2 font-semibold text-white hover:bg-amber-700 cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>{lang === 'fr' ? 'Archiver' : 'Archive'}</span>
              </button>
              <Button variant="danger" onClick={() => handleArchiveOrDelete(true)}>
                {lang === 'fr' ? 'Supprimer' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        )}
      </ModalDialog>

      {/* Student School ID Card (Recto / Verso + QR) */}
      {idCardStudent && school && (
        <StudentIdCardModal
          student={idCardStudent}
          school={school}
          onClose={() => setIdCardStudent(null)}
        />
      )}
    </div>
  );
};
