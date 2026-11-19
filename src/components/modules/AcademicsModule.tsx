import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Edit2,
  GitBranch,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { PrintableIdCard } from '../../lib/exports.ts';
import {
  EDUCATIONAL_LEVELS,
  localizeName,
} from '../../lib/africanCurriculumCatalog.ts';
import { IdCardPreviewModal } from './StudentIdCardModal.tsx';
import { CurriculumSubjectsTab } from './academics/CurriculumSubjectsTab.tsx';
import {
  CoefficientMatrixTab,
  SeriesAndTracksTab,
} from './academics/SeriesAndCoefficientsTabs.tsx';
import {
  AlertBanner,
  Button,
  ModalDialog,
  PageHeader,
  SegmentedTabs,
  SurfaceCard,
  TableSkeleton,
  inputBaseClass,
} from '../ui/DesignSystem.tsx';

export const AcademicsModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [tab, setTab] = useState<'classes' | 'subjects' | 'series' | 'coefficients' | 'years'>(
    'classes'
  );
  const [data, setData] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Educational levels selector & auto-provisioning
  const [enabledLevels, setEnabledLevels] = useState<string[]>([
    'preschool',
    'primary',
    'junior_secondary',
    'senior_secondary',
  ]);
  const [provisioning, setProvisioning] = useState(false);
  const [classLevelFilter, setClassLevelFilter] = useState('');

  // Create / Edit Class modal or panel
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [className, setClassName] = useState('');
  const [classNameEn, setClassNameEn] = useState('');
  const [classLevelKey, setClassLevelKey] = useState('junior_secondary');
  const [classSection, setClassSection] = useState('A');
  const [classRoom, setClassRoom] = useState('');
  const [classCapacity, setClassCapacity] = useState(40);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [classSeriesId, setClassSeriesId] = useState('');
  const [classSpecId, setClassSpecId] = useState('');
  const [classYearId, setClassYearId] = useState('');
  const [classStatus, setClassStatus] = useState('active');
  const [savingClass, setSavingClass] = useState(false);

  // Expanded enrolled students drawers & Class ID Card preview
  const [expandedClassStudents, setExpandedClassStudents] = useState<Record<number, boolean>>({});
  const [previewClassCard, setPreviewClassCard] = useState<PrintableIdCard | null>(null);

  // Assign subject to class form
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(4);

  // Academic years & terms
  const [yearName, setYearName] = useState('2026-2027');
  const [yearStart, setYearStart] = useState('2026-09-14');
  const [yearEnd, setYearEnd] = useState('2027-06-30');
  const [termName, setTermName] = useState('Trimestre 1');
  const [termYearId, setTermYearId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [struct, tRes] = await Promise.all([
        apiRequest<any>('/api/academics/structure'),
        apiRequest<{ items: any[] }>('/api/teachers'),
      ]);
      setData(struct);
      setTeachers(tRes.items || []);
      if (Array.isArray(struct.curriculumProfile?.enabledLevels)) {
        setEnabledLevels(struct.curriculumProfile.enabledLevels);
      }
      if (struct.classes?.[0] && !assignClassId) setAssignClassId(String(struct.classes[0].id));
      if (struct.subjects?.[0] && !assignSubjectId) setAssignSubjectId(String(struct.subjects[0].id));
      if (struct.academicYears?.[0] && !termYearId) {
        setTermYearId(String(struct.academicYears[0].id));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredClasses = useMemo(() => {
    const list = data?.classes || [];
    if (!classLevelFilter) return list;
    return list.filter((c: any) => c.levelKey === classLevelFilter);
  }, [data?.classes, classLevelFilter]);

  const openCreateClass = () => {
    setEditingClass(null);
    const activeYear = data?.academicYears?.find((y: any) => y.isCurrent) || data?.academicYears?.[0];
    setClassName('');
    setClassNameEn('');
    setClassLevelKey('junior_secondary');
    setClassSection('A');
    setClassRoom('');
    setClassCapacity(40);
    setHomeroomTeacherId('');
    setClassSeriesId('');
    setClassSpecId('');
    setClassYearId(activeYear ? String(activeYear.id) : '');
    setClassStatus('active');
    setShowClassModal(true);
  };

  const openEditClass = (cls: any) => {
    setEditingClass(cls);
    setClassName(cls.name || '');
    setClassNameEn(cls.nameEn || cls.name || '');
    setClassLevelKey(cls.levelKey || 'junior_secondary');
    setClassSection(cls.section || 'A');
    setClassRoom(cls.room || '');
    setClassCapacity(cls.capacity || 40);
    setHomeroomTeacherId(cls.homeroomTeacherId ? String(cls.homeroomTeacherId) : '');
    setClassSeriesId(cls.seriesId ? String(cls.seriesId) : '');
    setClassSpecId(cls.specializationId ? String(cls.specializationId) : '');
    setClassYearId(cls.academicYearId ? String(cls.academicYearId) : '');
    setClassStatus(cls.status || 'active');
    setShowClassModal(true);
  };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSavingClass(true);
    try {
      const levelObj = EDUCATIONAL_LEVELS.find((l) => l.key === classLevelKey);
      const payload = {
        name: className.trim(),
        nameEn: (classNameEn || className).trim(),
        level: levelObj?.labelFr || 'Collège',
        levelKey: classLevelKey,
        section: classSection,
        room: classRoom,
        capacity: Number(classCapacity) || 40,
        homeroomTeacherId: homeroomTeacherId ? Number(homeroomTeacherId) : null,
        seriesId: classSeriesId ? Number(classSeriesId) : null,
        specializationId: classSpecId ? Number(classSpecId) : null,
        academicYearId: classYearId ? Number(classYearId) : null,
        status: classStatus,
      };
      if (editingClass) {
        await apiRequest(`/api/academics/classes/${editingClass.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setNotice(lang === 'fr' ? 'Classe mise à jour et carte actualisée.' : 'Class updated.');
      } else {
        await apiRequest('/api/academics/classes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setNotice(
          lang === 'fr'
            ? 'Classe créée avec son N° unique et sa carte de classe.'
            : 'Class created with unique ID and Class ID Card.'
        );
      }
      setShowClassModal(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingClass(false);
    }
  };

  const handleAutoProvisionClasses = async () => {
    if (enabledLevels.length === 0) {
      setError(
        lang === 'fr'
          ? 'Sélectionnez au moins un niveau éducatif à activer.'
          : 'Select at least one educational level to activate.'
      );
      return;
    }
    setProvisioning(true);
    setError(null);
    setNotice(null);
    try {
      const activeYear = data?.academicYears?.find((y: any) => y.isCurrent) || data?.academicYears?.[0];
      const res = await apiRequest<{ createdCount: number }>('/api/academics/classes/auto-provision', {
        method: 'POST',
        body: JSON.stringify({
          levels: enabledLevels,
          academicYearId: activeYear?.id || null,
          generateCards: true,
        }),
      });
      await load();
      setNotice(
        lang === 'fr'
          ? `${res.createdCount} classe(s) bilingue(s) et cartes de classe générées automatiquement.`
          : `${res.createdCount} bilingual class(es) and Class ID Cards auto-provisioned.`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handlePreviewClassCard = async (cls: any) => {
    setError(null);
    try {
      let cardRecord = cls.idCard;
      if (!cardRecord) {
        const gen = await apiRequest<{ cards: any[] }>('/api/id-cards/generate', {
          method: 'POST',
          body: JSON.stringify({ targetType: 'single_class', classId: cls.id }),
        });
        cardRecord = gen.cards?.[0];
        await load();
      }
      const serName = localizeName(lang, cls.seriesNameFr, cls.seriesNameEn);
      const specName = localizeName(lang, cls.specializationNameFr, cls.specializationNameEn);
      setPreviewClassCard({
        cardType: 'class',
        cardNumber: cardRecord?.cardNumber || `CARD-${cls.classCode}`,
        holderName: localizeName(lang, cls.name, cls.nameEn),
        holderCode: cls.classCode || `CLS-${1000 + cls.id}`,
        designationOrClass: `${cls.homeroomTeacherName} · ${cls.studentCount}/${cls.capacity}`,
        academicYearOrStatus: cls.academicYearName || '2026-2027',
        photoUrl: school?.logoUrl || '',
        verificationCode: cardRecord?.verificationCode,
        status: cls.status || 'active',
        classMeta: {
          classNameFr: cls.name,
          classNameEn: cls.nameEn || cls.name,
          level: cls.level,
          room: cls.room,
          capacity: cls.capacity,
          studentCount: cls.studentCount,
          teacherName: cls.homeroomTeacherName,
          seriesName: serName,
          specializationName: specName,
        },
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAutoAssignClassSubjects = async (cls: any) => {
    setError(null);
    setNotice(null);
    try {
      const res = await apiRequest<{ assignedCount: number }>(
        `/api/academics/classes/${cls.id}/auto-assign-subjects`,
        {
          method: 'POST',
          body: JSON.stringify({ academicYearId: cls.academicYearId || null }),
        }
      );
      await load();
      setNotice(
        lang === 'fr'
          ? `${res.assignedCount} matière(s) associées automatiquement à ${cls.name}.`
          : `${res.assignedCount} subject(s) auto-associated with ${cls.nameEn || cls.name}.`
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const assignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/academics/class-subjects', {
        method: 'POST',
        body: JSON.stringify({
          classId: assignClassId,
          subjectId: assignSubjectId,
          teacherId: assignTeacherId || null,
          weeklyHours,
        }),
      });
      await load();
      setNotice(lang === 'fr' ? 'Matière affectée à la classe.' : 'Subject assigned to class.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/academics/years', {
        method: 'POST',
        body: JSON.stringify({
          name: yearName,
          startDate: yearStart,
          endDate: yearEnd,
          isCurrent: true,
        }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/academics/terms', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: termYearId,
          name: termName,
          startDate: yearStart,
          endDate: yearEnd,
          isCurrent: true,
        }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading || !data) {
    return (
      <SurfaceCard padding="none">
        <TableSkeleton rows={5} cols={4} />
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          lang === 'fr'
            ? 'Classes, Programmes & Coefficients'
            : 'Classes, Curriculum & Coefficients'
        }
        subtitle={
          <>
            <span className="font-mono-tabular font-semibold">{data.classes.length}</span>{' '}
            {lang === 'fr' ? 'classes' : 'classes'} ·{' '}
            <span className="font-mono-tabular font-semibold">{data.subjects.length}</span>{' '}
            {lang === 'fr' ? 'matières' : 'subjects'} ·{' '}
            <span className="font-mono-tabular font-semibold">
              {(data.academicSeries || []).length}
            </span>{' '}
            {lang === 'fr' ? 'séries' : 'series'}
          </>
        }
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: 'classes',
                label: lang === 'fr' ? 'Classes & Cartes' : 'Classes & ID Cards',
                icon: <Layers className="h-3.5 w-3.5" />,
              },
              {
                id: 'subjects',
                label: lang === 'fr' ? 'Matières & Pays' : 'Subjects Library',
                icon: <BookOpen className="h-3.5 w-3.5" />,
              },
              {
                id: 'series',
                label: lang === 'fr' ? 'Séries & TVET' : 'Series & Tracks',
                icon: <GitBranch className="h-3.5 w-3.5" />,
              },
              {
                id: 'coefficients',
                label: lang === 'fr' ? 'Coefficients' : 'Coefficients',
              },
              {
                id: 'years',
                label: lang === 'fr' ? 'Années & Trimestres' : 'Years & Terms',
                icon: <Calendar className="h-3.5 w-3.5" />,
              },
            ]}
          />
        }
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}
      {notice && <AlertBanner type="success">{notice}</AlertBanner>}

      {tab === 'classes' && (
        <div className="space-y-6">
          {/* Educational Levels Selector & Bilingual Auto-Provisioner */}
          <SurfaceCard>
            <div className="flex flex-wrap items-start justify-between gap-4 text-xs">
              <div className="space-y-2 flex-1 min-w-[260px]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#1E40AF] dark:text-blue-400" />
                  <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                    {lang === 'fr'
                      ? 'Niveaux Éducatifs Offerts & Structure Bilingue (Petite Section → Terminale)'
                      : 'Offered Educational Levels & Bilingual Auto-Structure (Nursery 1 → Grade 13)'}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Activez uniquement les cycles proposés par votre établissement, puis générez automatiquement les classes bilingues FR/EN et leurs cartes officielles.'
                    : 'Check only the educational levels your school offers, then auto-create standardized FR/EN classes and Class ID Cards.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
                  {EDUCATIONAL_LEVELS.map((lvl) => {
                    const checked = enabledLevels.includes(lvl.key);
                    return (
                      <label
                        key={lvl.key}
                        className={`flex items-start gap-2 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#1E40AF] bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-600'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEnabledLevels((prev) =>
                              prev.includes(lvl.key)
                                ? prev.filter((k) => k !== lvl.key)
                                : [...prev, lvl.key]
                            )
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {localizeName(lang, lvl.labelFr, lvl.labelEn)}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {lang === 'fr' ? lvl.rangeFr : lvl.rangeEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  disabled={provisioning}
                  onClick={handleAutoProvisionClasses}
                >
                  <Sparkles className="h-4 w-4 text-[#1E40AF] dark:text-blue-400" />
                  <span>
                    {provisioning
                      ? '...'
                      : lang === 'fr'
                      ? 'Générer Classes Bilingues'
                      : 'Auto-Create Bilingual Classes'}
                  </span>
                </Button>
                <Button variant="primary" onClick={openCreateClass}>
                  <Plus className="h-4 w-4" />
                  <span>{lang === 'fr' ? 'Nouvelle classe' : 'New Class'}</span>
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4">
              <SurfaceCard>
                <form onSubmit={assignSubject} className="space-y-3 text-xs">
                  <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                    {lang === 'fr'
                      ? 'Assigner matière & enseignant'
                      : 'Assign Subject & Teacher'}
                  </h2>
                  <select
                    required
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className={inputBaseClass}
                  >
                    {data.classes.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {localizeName(lang, c.name, c.nameEn)} ({c.classCode})
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    className={inputBaseClass}
                  >
                    {data.subjects.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {localizeName(lang, s.nameFr || s.name, s.nameEn)} (Coeff {s.coefficient})
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignTeacherId}
                    onChange={(e) => setAssignTeacherId(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="">
                      {lang === 'fr' ? 'Choisir l’enseignant' : 'Select Teacher'}
                    </option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(Number(e.target.value))}
                    placeholder={lang === 'fr' ? 'Heures / semaine' : 'Hours / week'}
                    className={inputBaseClass}
                  />
                  <Button type="submit" variant="outline" className="w-full">
                    {lang === 'fr' ? 'Assigner à la classe' : 'Assign to Class'}
                  </Button>
                </form>
              </SurfaceCard>

              <SurfaceCard padding="sm" className="text-xs space-y-2">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Filtrer par niveau' : 'Filter by Level'}
                </label>
                <select
                  value={classLevelFilter}
                  onChange={(e) => setClassLevelFilter(e.target.value)}
                  className={inputBaseClass}
                >
                  <option value="">
                    {lang === 'fr'
                      ? `Tous les niveaux (${data.classes.length})`
                      : `All Levels (${data.classes.length})`}
                  </option>
                  {EDUCATIONAL_LEVELS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {localizeName(lang, l.labelFr, l.labelEn)}
                    </option>
                  ))}
                </select>
              </SurfaceCard>
            </div>

            <div className="space-y-4 lg:col-span-8">
              {filteredClasses.length === 0 ? (
                <SurfaceCard className="py-10 text-center text-xs text-slate-400">
                  {lang === 'fr'
                    ? 'Aucune classe enregistrée dans cette vue. Utilisez "Générer Classes Bilingues" ou "Nouvelle classe".'
                    : 'No classes in this filter. Click Auto-Create Bilingual Classes or New Class above.'}
                </SurfaceCard>
              ) : (
                filteredClasses.map((cls: any) => {
                  const isExpanded = Boolean(expandedClassStudents[cls.id]);
                  const seriesLabel = localizeName(lang, cls.seriesNameFr, cls.seriesNameEn);
                  const specLabel = localizeName(
                    lang,
                    cls.specializationNameFr,
                    cls.specializationNameEn
                  );
                  return (
                    <SurfaceCard key={cls.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular text-xs font-bold text-[#1E40AF] dark:text-blue-400">
                              {cls.classCode}
                            </span>
                            <h3 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
                              {localizeName(lang, cls.name, cls.nameEn)}
                            </h3>
                            {cls.nameEn && cls.nameEn !== cls.name && (
                              <span className="text-xs text-slate-400">
                                / {lang === 'fr' ? cls.nameEn : cls.name}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              · {cls.level}
                              {cls.status === 'inactive' ? ' · Inactive' : ''}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {lang === 'fr' ? 'Salle' : 'Room'} : {cls.room || '—'} ·{' '}
                            {lang === 'fr' ? 'Effectif' : 'Enrolled'} :{' '}
                            <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                              {cls.studentCount} / {cls.capacity}
                            </span>{' '}
                            · {lang === 'fr' ? 'Titulaire' : 'Teacher'} : {cls.homeroomTeacherName}
                            {seriesLabel ? ` · ${seriesLabel}` : ''}
                            {specLabel ? ` (${specLabel})` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewClassCard(cls)}
                          >
                            <CreditCard className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
                            <span>{lang === 'fr' ? 'Carte Classe' : 'Class Card'}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAutoAssignClassSubjects(cls)}
                            title={
                              lang === 'fr'
                                ? 'Associer automatiquement les matières selon le niveau ou la série'
                                : 'Auto-assign curriculum subjects by level or series'
                            }
                          >
                            <Wand2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{lang === 'fr' ? 'Auto-Matières' : 'Auto Subjects'}</span>
                          </Button>
                          <button
                            type="button"
                            onClick={() => openEditClass(cls)}
                            title={lang === 'fr' ? 'Modifier la classe' : 'Edit class'}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await apiRequest(`/api/academics/classes/${cls.id}`, {
                                  method: 'DELETE',
                                });
                                await load();
                                setNotice(
                                  lang === 'fr' ? 'Classe supprimée.' : 'Class deleted.'
                                );
                              } catch (err: any) {
                                setError(err.message);
                              }
                            }}
                            title={lang === 'fr' ? 'Supprimer la classe' : 'Delete class'}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Enrolled Students toggle */}
                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedClassStudents((prev) => ({
                              ...prev,
                              [cls.id]: !isExpanded,
                            }))
                          }
                          className="inline-flex items-center gap-1.5 font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span>
                            {lang === 'fr'
                              ? `Liste des élèves inscrits (${cls.studentCount})`
                              : `Enrolled Students List (${cls.studentCount})`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3 text-xs">
                          {cls.enrolledStudents?.length === 0 ? (
                            <p className="text-slate-400">
                              {lang === 'fr'
                                ? 'Aucun élève inscrit dans cette classe.'
                                : 'No students enrolled in this class yet.'}
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {cls.enrolledStudents.map((st: any) => (
                                <div
                                  key={st.id}
                                  className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-2.5 py-1.5"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {st.firstName} {st.lastName}
                                  </span>
                                  <span className="font-mono-tabular text-[11px] text-slate-500">
                                    {st.registrationNumber}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Subjects assigned */}
                      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {cls.subjects.length === 0 ? (
                          <p className="py-2 text-slate-400">
                            {lang === 'fr'
                              ? 'Aucune matière assignée.'
                              : 'No subjects assigned yet.'}
                          </p>
                        ) : (
                          cls.subjects.map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between py-2">
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                  {localizeName(
                                    lang,
                                    sub.subjectNameFr || sub.subjectName,
                                    sub.subjectNameEn
                                  )}
                                </span>
                                <span className="ml-2 font-mono-tabular text-slate-500 dark:text-slate-400">
                                  Coeff {sub.coefficient} · {sub.weeklyHours}h/sem ·{' '}
                                  {sub.teacherName}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/academics/class-subjects/${sub.id}`, {
                                    method: 'DELETE',
                                  });
                                  await load();
                                }}
                                className="text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </SurfaceCard>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <CurriculumSubjectsTab
          lang={lang}
          schoolName={school?.name}
          data={data}
          teachers={teachers}
          onRefresh={load}
          onError={setError}
          onNotice={setNotice}
        />
      )}

      {tab === 'series' && (
        <SeriesAndTracksTab
          lang={lang}
          data={data}
          onRefresh={load}
          onError={setError}
          onNotice={setNotice}
        />
      )}

      {tab === 'coefficients' && (
        <CoefficientMatrixTab
          lang={lang}
          data={data}
          onRefresh={load}
          onError={setError}
          onNotice={setNotice}
        />
      )}

      {tab === 'years' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SurfaceCard className="space-y-4 text-xs">
            <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Années Académiques' : 'Academic Years'}
            </h2>
            <form onSubmit={createYear} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                required
                value={yearName}
                onChange={(e) => setYearName(e.target.value)}
                placeholder="2026-2027"
                className={inputBaseClass}
              />
              <input
                type="date"
                value={yearStart}
                onChange={(e) => setYearStart(e.target.value)}
                className={inputBaseClass}
              />
              <input
                type="date"
                value={yearEnd}
                onChange={(e) => setYearEnd(e.target.value)}
                className={inputBaseClass}
              />
              <Button type="submit" variant="primary">
                {lang === 'fr' ? 'Ajouter' : 'Add'}
              </Button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.academicYears.map((y: any) => (
                <div key={y.id} className="flex items-center justify-between py-2.5 gap-2">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{y.name}</span>
                    <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                      {y.startDate} → {y.endDate}
                    </p>
                  </div>
                  {y.isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {lang === 'fr' ? 'Active' : 'Active'}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await apiRequest(`/api/academics/years/${y.id}/activate`, {
                          method: 'PATCH',
                        });
                        await load();
                      }}
                    >
                      {lang === 'fr' ? 'Activer' : 'Set Active'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4 text-xs">
            <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Trimestres / Semestres' : 'Terms / Semesters'}
            </h2>
            <form onSubmit={createTerm} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={termYearId}
                onChange={(e) => setTermYearId(e.target.value)}
                className={inputBaseClass}
              >
                {data.academicYears.map((y: any) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <input
                required
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
                placeholder="Trimestre 1"
                className={inputBaseClass}
              />
              <Button type="submit" variant="primary">
                {lang === 'fr' ? 'Ajouter' : 'Add'}
              </Button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.terms.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <span className="font-semibold text-slate-900 dark:text-white">{t.name}</span>
                  <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                    {t.startDate} → {t.endDate}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* Create / Edit Class Modal */}
      <ModalDialog
        open={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={
          editingClass
            ? lang === 'fr'
              ? `Modifier la classe (${editingClass.classCode})`
              : `Edit Class (${editingClass.classCode})`
            : lang === 'fr'
            ? 'Créer une nouvelle classe bilingue'
            : 'Create Bilingual Class'
        }
      >
        <form onSubmit={saveClass} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom en français *' : 'French Class Name *'}
              </label>
              <input
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="ex: Terminale C, 6e A"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom en anglais' : 'English Class Name'}
              </label>
              <input
                value={classNameEn}
                onChange={(e) => setClassNameEn(e.target.value)}
                placeholder="e.g. Grade 13 C, Grade 7 A"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Cycle / Niveau' : 'Level'}
              </label>
              <select
                value={classLevelKey}
                onChange={(e) => setClassLevelKey(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                {EDUCATIONAL_LEVELS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {localizeName(lang, l.labelFr, l.labelEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Section</label>
              <input
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                placeholder="A"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Capacité max' : 'Max Capacity'}
              </label>
              <input
                type="number"
                min={5}
                value={classCapacity}
                onChange={(e) => setClassCapacity(Number(e.target.value))}
                className={`mt-1 font-mono-tabular ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Salle attribuée' : 'Classroom'}
              </label>
              <input
                value={classRoom}
                onChange={(e) => setClassRoom(e.target.value)}
                placeholder="Salle B-104"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Professeur titulaire' : 'Class Teacher'}
              </label>
              <select
                value={homeroomTeacherId}
                onChange={(e) => setHomeroomTeacherId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Optionnel' : 'Optional'}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Année académique' : 'Academic Year'}
              </label>
              <select
                value={classYearId}
                onChange={(e) => setClassYearId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Par défaut' : 'Default'}</option>
                {(data.academicYears || []).map((y: any) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Série (optionnel)' : 'Academic Series'}
              </label>
              <select
                value={classSeriesId}
                onChange={(e) => setClassSeriesId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Aucune / Tronc commun' : 'None / Core'}</option>
                {(data.academicSeries || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {localizeName(lang, s.nameFr, s.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Filière TVET (opt.)' : 'Vocational Track'}
              </label>
              <select
                value={classSpecId}
                onChange={(e) => setClassSpecId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Aucune' : 'None'}</option>
                {(data.specializations || []).map((sp: any) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.code} · {localizeName(lang, sp.nameFr, sp.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Statut' : 'Status'}
              </label>
              <select
                value={classStatus}
                onChange={(e) => setClassStatus(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="active">{lang === 'fr' ? 'Active' : 'Active'}</option>
                <option value="inactive">{lang === 'fr' ? 'Inactive' : 'Inactive'}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowClassModal(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" disabled={savingClass}>
              {savingClass
                ? '...'
                : editingClass
                ? lang === 'fr'
                  ? 'Enregistrer'
                  : 'Save Changes'
                : lang === 'fr'
                ? 'Créer la classe'
                : 'Create Class'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Class Identification Card Modal */}
      {previewClassCard && school && (
        <IdCardPreviewModal
          card={previewClassCard}
          school={school}
          onClose={() => setPreviewClassCard(null)}
        />
      )}
    </div>
  );
};
