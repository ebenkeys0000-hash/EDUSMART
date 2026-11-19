import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  FileSpreadsheet,
  User,
  Check,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportTableToPdf, exportToExcel, PrintableIdCard } from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { localizeName } from '../../lib/africanCurriculumCatalog.ts';
import { PhotoCaptureCropper } from '../ui/PhotoCaptureCropper.tsx';
import { IdCardPreviewModal } from './StudentIdCardModal.tsx';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
  ModalDialog,
  TableSkeleton,
} from '../ui/DesignSystem.tsx';

interface TeacherRow {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  photoUrl: string;
  qualification: string;
  specialization: string;
  employmentType: string;
  hireDate: string;
  baseSalary: number;
  status: string;
  assignedClassIds?: number[];
  assignedSubjectIds?: number[];
  assignedClasses: string[];
  assignedSubjects: string[];
  idCard?: {
    cardNumber: string;
    verificationCode: string;
    designationOrClass: string;
    academicYearOrStatus: string;
    status: string;
  } | null;
}

interface SimpleOption {
  id: number;
  name: string;
  nameFr?: string;
  nameEn?: string;
}

export const TeachersModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [items, setItems] = useState<TeacherRow[]>([]);
  const [classesList, setClassesList] = useState<SimpleOption[]>([]);
  const [subjectsList, setSubjectsList] = useState<SimpleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [attNotice, setAttNotice] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<PrintableIdCard | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'M',
    dateOfBirth: '',
    email: '',
    phone: '',
    address: '',
    photoUrl: '',
    qualification: '',
    specialization: '',
    employmentType: 'full_time',
    hireDate: new Date().toISOString().slice(0, 10),
    baseSalary: 180000,
    status: 'active',
    assignedClassIds: [] as number[],
    assignedSubjectIds: [] as number[],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [res, acad] = await Promise.all([
        apiRequest<{ items: TeacherRow[] }>('/api/teachers'),
        apiRequest<{ classes: SimpleOption[]; subjects: SimpleOption[] }>('/api/academics/structure'),
      ]);
      setItems(res.items || []);
      setClassesList(acad.classes || []);
      setSubjectsList(acad.subjects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setForm({
      firstName: '',
      lastName: '',
      gender: 'M',
      dateOfBirth: '',
      email: '',
      phone: '',
      address: '',
      photoUrl: '',
      qualification: '',
      specialization: '',
      employmentType: 'full_time',
      hireDate: new Date().toISOString().slice(0, 10),
      baseSalary: 180000,
      status: 'active',
      assignedClassIds: [],
      assignedSubjectIds: [],
    });
    setShowForm(true);
  };

  const openEdit = (t: TeacherRow) => {
    setEditing(t);
    setFormError(null);
    setForm({
      firstName: t.firstName,
      lastName: t.lastName,
      gender: t.gender || 'M',
      dateOfBirth: t.dateOfBirth || '',
      email: t.email || '',
      phone: t.phone || '',
      address: t.address || '',
      photoUrl: t.photoUrl || '',
      qualification: t.qualification || '',
      specialization: t.specialization || '',
      employmentType: t.employmentType || 'full_time',
      hireDate: t.hireDate || new Date().toISOString().slice(0, 10),
      baseSalary: t.baseSalary || 0,
      status: t.status || 'active',
      assignedClassIds: t.assignedClassIds || [],
      assignedSubjectIds: t.assignedSubjectIds || [],
    });
    setShowForm(true);
  };

  const toPrintableCard = (t: TeacherRow): PrintableIdCard => ({
    cardType: 'teacher',
    cardNumber: t.idCard?.cardNumber || `STF-${t.employeeCode}`,
    holderName: `${t.firstName} ${t.lastName}`.trim(),
    holderCode: t.employeeCode,
    designationOrClass:
      t.idCard?.designationOrClass ||
      `Enseignant · ${
        t.assignedSubjects?.length > 0
          ? t.assignedSubjects.slice(0, 2).join(', ')
          : t.specialization || t.qualification || 'Pédagogie'
      }`,
    academicYearOrStatus:
      t.idCard?.academicYearOrStatus ||
      `${t.status === 'active' ? 'Actif' : t.status === 'on_leave' ? 'En congé' : 'Inactif'} · ${
        t.employmentType === 'full_time'
          ? 'Temps plein'
          : t.employmentType === 'part_time'
          ? 'Vacataire'
          : 'Contractuel'
      }`,
    photoUrl: t.photoUrl,
    verificationCode: t.idCard?.verificationCode,
    status: t.idCard?.status || (t.status === 'active' ? 'active' : 'inactive'),
    gender: t.gender,
    dateOfBirth: t.dateOfBirth,
    assignedClasses: t.assignedClasses,
  });

  const toggleSelection = (list: number[], id: number) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.photoUrl.trim()) {
      setFormError(
        lang === 'fr'
          ? "La photo d'identité de l'enseignant est obligatoire pour l'enregistrement et la création de la carte professionnelle."
          : 'Teacher photograph is mandatory for registration and automatic ID card generation.'
      );
      return;
    }

    setSaving(true);
    try {
      let createdCard: PrintableIdCard | null = null;
      if (editing) {
        await apiRequest(`/api/teachers/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        const res = await apiRequest<{
          teacher: TeacherRow;
          idCard?: {
            cardNumber: string;
            verificationCode: string;
            designationOrClass: string;
            academicYearOrStatus: string;
            status: string;
          };
        }>('/api/teachers', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const selectedClassNames = classesList
          .filter((c) => form.assignedClassIds.includes(c.id))
          .map((c) => localizeName(lang, c.name, c.nameEn));
        const selectedSubjectNames = subjectsList
          .filter((s) => form.assignedSubjectIds.includes(s.id))
          .map((s) => localizeName(lang, s.nameFr || s.name, s.nameEn));

        createdCard = toPrintableCard({
          ...res.teacher,
          assignedClasses: selectedClassNames,
          assignedSubjects: selectedSubjectNames,
          idCard: res.idCard || res.teacher.idCard,
        });
      }
      setShowForm(false);
      await load();
      if (createdCard) {
        setPreviewCard(createdCard);
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/teachers/${id}`, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markPresentToday = async (teacherId: number, name: string) => {
    try {
      await apiRequest('/api/teachers/attendance', {
        method: 'POST',
        body: JSON.stringify({
          teacherId,
          date: new Date().toISOString().slice(0, 10),
          status: 'present',
        }),
      });
      setAttNotice(`Présence enregistrée aujourd'hui pour ${name}`);
      setTimeout(() => setAttNotice(null), 3500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const currency = school?.currency || 'XOF';

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Corps Enseignant' : 'Teacher Management'}
        subtitle={
          <>
            <span className="font-mono-tabular font-semibold">{items.length}</span>{' '}
            {lang === 'fr' ? 'enseignants enregistrés' : 'teachers registered'}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  items.map((t) => ({
                    Code: t.employeeCode,
                    Nom: `${t.firstName} ${t.lastName}`,
                    Spécialité: t.specialization,
                    Diplôme: t.qualification,
                    Téléphone: t.phone,
                    Statut: t.status,
                    SalaireBase: t.baseSalary,
                  })),
                  'Enseignants',
                  'EDUSMART_Enseignants'
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
                  'Liste du Corps Enseignant',
                  `${items.length} enseignants`,
                  ['Code', 'Nom complet', 'Spécialité', 'Qualification', 'Téléphone', 'Salaire'],
                  items.map((t) => [
                    t.employeeCode,
                    `${t.firstName} ${t.lastName}`,
                    t.specialization || '—',
                    t.qualification || '—',
                    t.phone || '—',
                    formatCurrency(t.baseSalary, currency),
                  ]),
                  'EDUSMART_Enseignants',
                  school?.name
                )
              }
            >
              <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <span>PDF</span>
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Nouvel enseignant' : 'Add Teacher'}</span>
            </Button>
          </>
        }
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}
      {attNotice && <AlertBanner type="success">{attNotice}</AlertBanner>}

      <SurfaceCard padding="none" className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-slate-400">
            {lang === 'fr' ? 'Aucun enseignant enregistré.' : 'No teachers registered.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    {lang === 'fr' ? 'Enseignant' : 'Teacher'}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {lang === 'fr' ? 'Qualifications & Matières' : 'Qualifications'}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {lang === 'fr' ? 'Classes assignées' : 'Assigned Classes'}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {lang === 'fr' ? 'Statut & Salaire' : 'Status & Salary'}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {t.photoUrl ? (
                          <img
                            src={t.photoUrl}
                            alt={t.firstName}
                            className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <User className="h-4 w-4" />
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {t.firstName} {t.lastName}
                          </p>
                          <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                            {t.employeeCode} · {t.phone || t.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        {t.qualification || '—'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.assignedSubjects.length > 0
                          ? t.assignedSubjects.join(', ')
                          : t.specialization || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {t.assignedClasses.length > 0 ? t.assignedClasses.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                        {formatCurrency(t.baseSalary, currency)}
                      </p>
                      <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {t.status} · {t.hireDate || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewCard(toPrintableCard(t))}
                          title={lang === 'fr' ? 'Carte Enseignant (Recto / Verso)' : 'Staff ID Card'}
                          className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] dark:hover:text-blue-400 cursor-pointer"
                        >
                          <CreditCard className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => markPresentToday(t.id, `${t.firstName} ${t.lastName}`)}
                          title="Pointer présent aujourd'hui"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer whitespace-nowrap"
                        >
                          <Check className="inline h-3 w-3 mr-0.5" />
                          Présent
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] dark:hover:text-blue-400 cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
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
        )}
      </SurfaceCard>

      <ModalDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="max-w-2xl"
        title={
          editing
            ? lang === 'fr'
              ? 'Modifier la fiche enseignant'
              : 'Edit Teacher'
            : lang === 'fr'
            ? 'Enregistrer un nouvel enseignant'
            : 'Register New Teacher'
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {formError && <AlertBanner type="error">{formError}</AlertBanner>}

          <PhotoCaptureCropper
            value={form.photoUrl}
            onChange={(url) => {
              setForm((p) => ({ ...p, photoUrl: url }));
              setFormError(null);
            }}
            ownerType="teacher"
            required
            label={lang === 'fr' ? "Photo officielle de l'enseignant" : 'Teacher Photograph'}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                {lang === 'fr' ? 'Téléphone *' : 'Phone *'}
              </label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              {lang === 'fr' ? 'Adresse domicile' : 'Residential Address'}
            </label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={lang === 'fr' ? 'Quartier, Ville' : 'District, City'}
              className={`mt-1 ${inputBaseClass}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Diplômes / Qualifications' : 'Qualifications'}
              </label>
              <input
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                placeholder="CAPES / Master"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Spécialité principale' : 'Primary Specialization'}
              </label>
              <input
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Mathématiques"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          {/* Subjects taught & Assigned classes */}
          {(subjectsList.length > 0 || classesList.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Matières enseignées' : 'Subjects Taught'}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 max-h-28 overflow-y-auto">
                  {subjectsList.map((s) => {
                    const selected = form.assignedSubjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            assignedSubjectIds: toggleSelection(p.assignedSubjectIds, s.id),
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0F2744] dark:bg-[#1E40AF] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {localizeName(lang, s.nameFr || s.name, s.nameEn)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Classes assignées' : 'Assigned Classes'}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 max-h-28 overflow-y-auto">
                  {classesList.map((c) => {
                    const selected = form.assignedClassIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            assignedClassIds: toggleSelection(p.assignedClassIds, c.id),
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#0F2744] dark:bg-[#1E40AF] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {localizeName(lang, c.name, c.nameEn)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? "Date d'embauche" : 'Employment Date'}
              </label>
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Statut emploi' : 'Status'}
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="active">{lang === 'fr' ? 'Actif' : 'Active'}</option>
                <option value="on_leave">{lang === 'fr' ? 'En congé' : 'On Leave'}</option>
                <option value="inactive">{lang === 'fr' ? 'Inactif' : 'Inactive'}</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Contrat' : 'Contract'}
              </label>
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="full_time">Temps plein</option>
                <option value="part_time">Vacataire</option>
                <option value="contract">Contractuel</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? `Salaire (${currency})` : `Salary (${currency})`}
              </label>
              <input
                type="number"
                min={0}
                value={form.baseSalary}
                onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })}
                className={`mt-1 font-mono-tabular ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={saving} variant="primary">
              {saving ? '...' : lang === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {previewCard && school && (
        <IdCardPreviewModal
          card={previewCard}
          school={school}
          onClose={() => setPreviewCard(null)}
        />
      )}
    </div>
  );
};
