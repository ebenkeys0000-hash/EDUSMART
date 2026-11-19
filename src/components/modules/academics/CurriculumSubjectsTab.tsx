import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Download,
  Edit2,
  FileSpreadsheet,
  Globe2,
  Layers,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api.ts';
import { exportTableToPdf, exportToExcel } from '../../../lib/exports.ts';
import {
  AFRICAN_COUNTRIES,
  AFRICAN_SUBJECT_LIBRARY,
  localizeName,
  SUBJECT_CATEGORIES,
} from '../../../lib/africanCurriculumCatalog.ts';
import {
  AlertBanner,
  Button,
  ModalDialog,
  SurfaceCard,
  inputBaseClass,
} from '../../ui/DesignSystem.tsx';

interface CurriculumSubjectsTabProps {
  lang: 'fr' | 'en';
  schoolName?: string;
  data: any;
  teachers: any[];
  onRefresh: () => Promise<void>;
  onError: (msg: string | null) => void;
  onNotice: (msg: string | null) => void;
}

const LEVEL_SCOPE_OPTIONS = [
  { key: 'preschool', labelFr: 'Maternelle', labelEn: 'Nursery / Preschool' },
  { key: 'primary', labelFr: 'Primaire', labelEn: 'Primary' },
  { key: 'junior_secondary', labelFr: 'Collège', labelEn: 'Junior Secondary' },
  { key: 'senior_secondary', labelFr: 'Lycée', labelEn: 'Senior Secondary' },
  { key: 'general', labelFr: 'Tronc Commun / Général', labelEn: 'General / Core' },
  { key: 'scientific', labelFr: 'Scientifique', labelEn: 'Scientific' },
  { key: 'literary', labelFr: 'Littéraire', labelEn: 'Literary' },
  { key: 'technical', labelFr: 'Technique', labelEn: 'Technical' },
  { key: 'vocational', labelFr: 'Professionnel / TVET', labelEn: 'Vocational / TVET' },
];

export const CurriculumSubjectsTab: React.FC<CurriculumSubjectsTabProps> = ({
  lang,
  schoolName,
  data,
  teachers,
  onRefresh,
  onError,
  onNotice,
}) => {
  const profile = data.curriculumProfile || {};
  const [countryCode, setCountryCode] = useState(profile.countryCode || 'BJ');
  const [systemType, setSystemType] = useState(profile.systemType || 'Francophone');
  const [gradingScale, setGradingScale] = useState<number>(profile.gradingScale || 20);
  const [passMark, setPassMark] = useState<number>(profile.passMark || 10);
  const [profileNotes, setProfileNotes] = useState(profile.notes || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add/Edit Subject form state
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('Mathematics');
  const [levelScope, setLevelScope] = useState('general');
  const [coefficient, setCoefficient] = useState(2);
  const [descriptionFr, setDescriptionFr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [subStatus, setSubStatus] = useState('active');
  const [savingSub, setSavingSub] = useState(false);

  // Library Modal
  const [showLibrary, setShowLibrary] = useState(false);
  const [libLevel, setLibLevel] = useState('');
  const [libCat, setLibCat] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [importingLib, setImportingLib] = useState(false);

  // Custom CSV/JSON import modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState(
    'CODE,Nom Français,English Name,Category,Level,Coeff\nBIO-AP,Biologie Appliquée,Applied Biology,Natural Sciences,scientific,3'
  );
  const [importingCustom, setImportingCustom] = useState(false);

  // Bulk Assign Modal
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkClassIds, setBulkClassIds] = useState<number[]>([]);
  const [bulkSubjectIds, setBulkSubjectIds] = useState<number[]>([]);
  const [bulkTeacherId, setBulkTeacherId] = useState('');
  const [bulkHours, setBulkHours] = useState(3);
  const [bulkSaving, setBulkSaving] = useState(false);

  const existingCodesSet = useMemo(
    () => new Set<string>((data.subjects || []).map((s: any) => String(s.code).toUpperCase())),
    [data.subjects]
  );

  const filteredSubjects = useMemo(() => {
    return (data.subjects || []).filter((s: any) => {
      if (catFilter && s.category !== catFilter) return false;
      if (levelFilter && s.levelScope !== levelFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${s.code} ${s.nameFr || s.name} ${s.nameEn || ''} ${s.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.subjects, catFilter, levelFilter, statusFilter, search]);

  const filteredLibrary = useMemo(() => {
    return AFRICAN_SUBJECT_LIBRARY.filter((item) => {
      if (libLevel && item.levelScope !== libLevel) return false;
      if (libCat && item.category !== libCat) return false;
      return true;
    });
  }, [libLevel, libCat]);

  const handleSelectCountry = (nextCode: string) => {
    setCountryCode(nextCode);
    const found = AFRICAN_COUNTRIES.find((c) => c.code === nextCode);
    if (found) {
      setSystemType(found.defaultSystem);
      setGradingScale(found.defaultScale);
      setPassMark(found.defaultPassMark);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    onError(null);
    onNotice(null);
    try {
      const countryObj = AFRICAN_COUNTRIES.find((c) => c.code === countryCode);
      await apiRequest('/api/academics/curriculum-profile', {
        method: 'PUT',
        body: JSON.stringify({
          countryCode,
          countryName: countryObj ? countryObj.nameEn : countryCode,
          systemType,
          gradingScale: Number(gradingScale) || 20,
          passMark: Number(passMark) || 10,
          notes: profileNotes,
        }),
      });
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? 'Modèle de programme et barème enregistrés pour cet établissement.'
          : 'Curriculum profile and grading scale saved for this school.'
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const resetSubjectForm = () => {
    setEditingSubjectId(null);
    setCode('');
    setNameFr('');
    setNameEn('');
    setCategory('Mathematics');
    setLevelScope('general');
    setCoefficient(2);
    setDescriptionFr('');
    setDescriptionEn('');
    setSubStatus('active');
  };

  const startEditSubject = (s: any) => {
    setEditingSubjectId(s.id);
    setCode(s.code || '');
    setNameFr(s.nameFr || s.name || '');
    setNameEn(s.nameEn || s.name || '');
    setCategory(s.category || 'Mathematics');
    setLevelScope(s.levelScope || 'general');
    setCoefficient(s.coefficient || 2);
    setDescriptionFr(s.descriptionFr || '');
    setDescriptionEn(s.descriptionEn || '');
    setSubStatus(s.status || 'active');
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSub(true);
    onError(null);
    onNotice(null);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        nameFr: nameFr.trim(),
        nameEn: (nameEn || nameFr).trim(),
        category,
        levelScope,
        coefficient: Number(coefficient) || 1,
        descriptionFr,
        descriptionEn,
        status: subStatus,
      };
      if (editingSubjectId) {
        await apiRequest(`/api/academics/subjects/${editingSubjectId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotice(lang === 'fr' ? 'Matière mise à jour.' : 'Subject updated.');
      } else {
        await apiRequest('/api/academics/subjects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotice(lang === 'fr' ? 'Matière créée avec succès.' : 'Subject created.');
      }
      resetSubjectForm();
      await onRefresh();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingSub(false);
    }
  };

  const handleImportLibrary = async () => {
    if (selectedCodes.length === 0) return;
    setImportingLib(true);
    onError(null);
    onNotice(null);
    try {
      const res = await apiRequest<{ importedCount: number }>('/api/academics/subjects/import-library', {
        method: 'POST',
        body: JSON.stringify({ codes: selectedCodes }),
      });
      setShowLibrary(false);
      setSelectedCodes([]);
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? `${res.importedCount} matière(s) importée(s) depuis la bibliothèque africaine.`
          : `${res.importedCount} subject(s) imported from the African library.`
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setImportingLib(false);
    }
  };

  const handleCustomImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingCustom(true);
    onError(null);
    try {
      let customItems: any[] = [];
      const trimmed = importText.trim();
      if (trimmed.startsWith('[')) {
        customItems = JSON.parse(trimmed);
      } else {
        const lines = trimmed
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        customItems = lines
          .filter((l, idx) => !(idx === 0 && l.toLowerCase().startsWith('code,')))
          .map((line) => {
            const parts = line.split(',').map((p) => p.trim());
            return {
              code: parts[0],
              nameFr: parts[1] || parts[0],
              nameEn: parts[2] || parts[1] || parts[0],
              category: parts[3] || 'General',
              levelScope: parts[4] || 'general',
              coefficient: Number(parts[5]) || 2,
            };
          });
      }
      const res = await apiRequest<{ importedCount: number }>('/api/academics/subjects/import-library', {
        method: 'POST',
        body: JSON.stringify({ customItems }),
      });
      setShowImport(false);
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? `${res.importedCount} matière(s) personnalisée(s) importée(s).`
          : `${res.importedCount} custom subject(s) imported.`
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setImportingCustom(false);
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkClassIds.length === 0 || bulkSubjectIds.length === 0) return;
    setBulkSaving(true);
    onError(null);
    try {
      const res = await apiRequest<{ assignedCount: number }>('/api/academics/class-subjects/bulk', {
        method: 'POST',
        body: JSON.stringify({
          classIds: bulkClassIds,
          subjectIds: bulkSubjectIds,
          teacherId: bulkTeacherId ? Number(bulkTeacherId) : null,
          weeklyHours: bulkHours,
          academicYearId: data.academicYears?.find((y: any) => y.isCurrent)?.id || null,
        }),
      });
      setShowBulkAssign(false);
      setBulkClassIds([]);
      setBulkSubjectIds([]);
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? `${res.assignedCount} affectation(s) classe-matière ajoutée(s).`
          : `${res.assignedCount} class-subject assignment(s) created.`
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configurable Country Curriculum Profile */}
      <SurfaceCard>
        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F2744] dark:bg-[#1E40AF] text-white shrink-0">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                  {lang === 'fr'
                    ? 'Profil Pays & Barème Scolaire Configurable'
                    : 'Configurable Country Profile & Grading Scale'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Modèle personnalisable par établissement (système francophone, anglophone ou bilingue). Ajustez librement le barème selon les règles de votre école.'
                    : 'Customizable school curriculum template (Francophone, Anglophone, or Bilingual). Adjust grading scale and thresholds to match your school rules.'}
                </p>
              </div>
            </div>
            <Button type="submit" variant="primary" disabled={savingProfile}>
              {savingProfile
                ? '...'
                : lang === 'fr'
                ? 'Enregistrer le profil'
                : 'Save Profile'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Pays' : 'Country'}
              </label>
              <select
                value={countryCode}
                onChange={(e) => handleSelectCountry(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                {AFRICAN_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {localizeName(lang, c.nameFr, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Système éducatif' : 'System'}
              </label>
              <select
                value={systemType}
                onChange={(e) => setSystemType(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="Francophone">Francophone</option>
                <option value="Anglophone">Anglophone</option>
                <option value="Bilingual">{lang === 'fr' ? 'Bilingue (FR/EN)' : 'Bilingual (FR/EN)'}</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Échelle de notation' : 'Grading Scale'}
              </label>
              <select
                value={gradingScale}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setGradingScale(s);
                  setPassMark(s / 2);
                }}
                className={`mt-1 font-mono-tabular ${inputBaseClass}`}
              >
                <option value={20}>/ 20</option>
                <option value={10}>/ 10</option>
                <option value={100}>/ 100 (%)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Moyenne de passage' : 'Pass Mark'}
              </label>
              <input
                type="number"
                step="0.5"
                min={1}
                max={gradingScale}
                value={passMark}
                onChange={(e) => setPassMark(Number(e.target.value))}
                className={`mt-1 font-mono-tabular ${inputBaseClass}`}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Notes de programme' : 'Template Notes'}
              </label>
              <input
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
                placeholder={lang === 'fr' ? 'Modèle personnalisable...' : 'Custom school notes...'}
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>
          </div>
        </form>
      </SurfaceCard>

      {/* Action Toolbar */}
      <SurfaceCard padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setShowLibrary(true)}>
              <BookOpen className="h-4 w-4" />
              <span>
                {lang === 'fr' ? 'Bibliothèque Africaine des Matières' : 'Import African Subjects Library'}
              </span>
            </Button>
            <Button variant="outline" onClick={() => setShowBulkAssign(true)}>
              <Layers className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Affectation en masse' : 'Bulk Assign to Classes'}</span>
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Import CSV / JSON' : 'Import CSV / JSON'}</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  filteredSubjects.map((s: any) => ({
                    Code: s.code,
                    Nom_FR: s.nameFr || s.name,
                    Name_EN: s.nameEn || s.name,
                    Categorie: s.category,
                    Cycle: s.levelScope,
                    Coefficient: s.coefficient,
                    Statut: s.status,
                  })),
                  'Matières',
                  'EDUSMART_Matieres_Curriculum'
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
                  lang === 'fr' ? 'Référentiel des Matières' : 'Curriculum Subjects List',
                  `${filteredSubjects.length} ${lang === 'fr' ? 'matières' : 'subjects'}`,
                  ['Code', 'Français', 'English', 'Catégorie', 'Cycle', 'Coeff'],
                  filteredSubjects.map((s: any) => [
                    s.code,
                    s.nameFr || s.name,
                    s.nameEn || s.name,
                    s.category || '—',
                    s.levelScope || '—',
                    s.coefficient,
                  ]),
                  'EDUSMART_Matieres',
                  schoolName
                )
              }
            >
              <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <span>PDF</span>
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {/* Create/Edit Subject + Subjects Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SurfaceCard className="lg:col-span-4 h-fit">
          <form onSubmit={handleSaveSubject} className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                {editingSubjectId
                  ? lang === 'fr'
                    ? 'Modifier la matière'
                    : 'Edit Subject'
                  : lang === 'fr'
                  ? 'Ajouter une matière bilingue'
                  : 'Add Bilingual Subject'}
              </h3>
              {editingSubjectId && (
                <button
                  type="button"
                  onClick={resetSubjectForm}
                  className="text-[11px] font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {lang === 'fr' ? 'Annuler' : 'Reset'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Code *</label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MATH"
                  className={`mt-1 uppercase font-mono-tabular ${inputBaseClass}`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Coeff par défaut' : 'Default Coeff'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={coefficient}
                  onChange={(e) => setCoefficient(Number(e.target.value))}
                  className={`mt-1 font-mono-tabular ${inputBaseClass}`}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom en français *' : 'French Name *'}
              </label>
              <input
                required
                value={nameFr}
                onChange={(e) => setNameFr(e.target.value)}
                placeholder="ex: Mathématiques"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Nom en anglais *' : 'English Name *'}
              </label>
              <input
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Mathematics"
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Catégorie' : 'Category'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`mt-1 ${inputBaseClass}`}
                >
                  {SUBJECT_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {localizeName(lang, c.labelFr, c.labelEn)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Portée / Cycle' : 'Level Scope'}
                </label>
                <select
                  value={levelScope}
                  onChange={(e) => setLevelScope(e.target.value)}
                  className={`mt-1 ${inputBaseClass}`}
                >
                  {LEVEL_SCOPE_OPTIONS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {localizeName(lang, l.labelFr, l.labelEn)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Description (FR)' : 'Description (FR)'}
              </label>
              <input
                value={descriptionFr}
                onChange={(e) => setDescriptionFr(e.target.value)}
                placeholder="Programme, objectifs..."
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Description (EN)' : 'Description (EN)'}
              </label>
              <input
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Syllabus summary..."
                className={`mt-1 ${inputBaseClass}`}
              />
            </div>

            {editingSubjectId && (
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Statut' : 'Status'}
                </label>
                <select
                  value={subStatus}
                  onChange={(e) => setSubStatus(e.target.value)}
                  className={`mt-1 ${inputBaseClass}`}
                >
                  <option value="active">{lang === 'fr' ? 'Active' : 'Active'}</option>
                  <option value="inactive">{lang === 'fr' ? 'Inactive' : 'Inactive'}</option>
                </select>
              </div>
            )}

            <Button type="submit" variant="primary" disabled={savingSub} className="w-full">
              <Plus className="h-4 w-4" />
              <span>
                {savingSub
                  ? '...'
                  : editingSubjectId
                  ? lang === 'fr'
                    ? 'Mettre à jour'
                    : 'Update Subject'
                  : lang === 'fr'
                  ? 'Créer la matière'
                  : 'Create Subject'}
              </span>
            </Button>
          </form>
        </SurfaceCard>

        <div className="space-y-4 lg:col-span-8">
          <SurfaceCard padding="sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 text-xs">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={lang === 'fr' ? 'Rechercher code, nom...' : 'Search code, name...'}
                  className={`${inputBaseClass} pl-8`}
                />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">{lang === 'fr' ? 'Toutes catégories' : 'All Categories'}</option>
                {SUBJECT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {localizeName(lang, c.labelFr, c.labelEn)}
                  </option>
                ))}
              </select>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">{lang === 'fr' ? 'Tous niveaux' : 'All Levels'}</option>
                {LEVEL_SCOPE_OPTIONS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {localizeName(lang, l.labelFr, l.labelEn)}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">{lang === 'fr' ? 'Tous statuts' : 'All Statuses'}</option>
                <option value="active">{lang === 'fr' ? 'Actives' : 'Active'}</option>
                <option value="inactive">{lang === 'fr' ? 'Inactives' : 'Inactive'}</option>
              </select>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Matière (FR / EN)' : 'Subject (EN / FR)'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Catégorie & Cycle' : 'Category & Scope'}
                    </th>
                    <th className="px-4 py-3 font-semibold">Coeff</th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Classes / Profs' : 'Classes / Staff'}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        {lang === 'fr'
                          ? 'Aucune matière ne correspond à ces filtres. Utilisez la Bibliothèque Africaine ci-dessus pour importer rapidement.'
                          : 'No subjects match these filters. Use the African Subjects Library above to import subjects.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((s: any) => {
                      const catObj = SUBJECT_CATEGORIES.find((c) => c.key === s.category);
                      const scopeObj = LEVEL_SCOPE_OPTIONS.find((l) => l.key === s.levelScope);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                            {s.code}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {localizeName(lang, s.nameFr || s.name, s.nameEn)}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {lang === 'fr' ? s.nameEn : s.nameFr || s.name}
                              {s.status === 'inactive' ? ' · Inactive' : ''}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            <p>{catObj ? localizeName(lang, catObj.labelFr, catObj.labelEn) : s.category}</p>
                            <p className="text-[11px] text-slate-400">
                              {scopeObj ? localizeName(lang, scopeObj.labelFr, scopeObj.labelEn) : s.levelScope}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono-tabular font-semibold">{s.coefficient}</td>
                          <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-mono-tabular font-semibold">
                              {s.assignedClassesCount ?? 0}
                            </span>{' '}
                            {lang === 'fr' ? 'classe(s)' : 'class(es)'}
                            {s.assignedTeachers?.length > 0 && (
                              <p className="text-slate-400 truncate max-w-[160px]">
                                {s.assignedTeachers.join(', ')}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditSubject(s)}
                                title={lang === 'fr' ? 'Modifier' : 'Edit'}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E40AF] cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  onError(null);
                                  try {
                                    await apiRequest(`/api/academics/subjects/${s.id}`, {
                                      method: 'DELETE',
                                    });
                                    await onRefresh();
                                    onNotice(lang === 'fr' ? 'Matière supprimée.' : 'Subject deleted.');
                                  } catch (err: any) {
                                    onError(err.message);
                                  }
                                }}
                                title={lang === 'fr' ? 'Supprimer' : 'Delete'}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* African Subjects Library Modal */}
      <ModalDialog
        open={showLibrary}
        onClose={() => setShowLibrary(false)}
        maxWidth="max-w-4xl"
        title={
          lang === 'fr'
            ? 'Bibliothèque Africaine des Matières Scolaires (FR / EN)'
            : 'African School Subjects Library (EN / FR)'
        }
        subtitle={
          lang === 'fr'
            ? 'Sélectionnez les matières adaptées à vos cycles (Maternelle, Primaire, Collège, Lycée, Technique & Professionnel).'
            : 'Select bilingual subjects across Preschool, Primary, Junior/Senior Secondary, Technical & Vocational tracks.'
        }
      >
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <select
                value={libLevel}
                onChange={(e) => setLibLevel(e.target.value)}
                className={`${inputBaseClass} w-auto`}
              >
                <option value="">{lang === 'fr' ? 'Tous cycles' : 'All Scopes'}</option>
                {LEVEL_SCOPE_OPTIONS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {localizeName(lang, l.labelFr, l.labelEn)}
                  </option>
                ))}
              </select>
              <select
                value={libCat}
                onChange={(e) => setLibCat(e.target.value)}
                className={`${inputBaseClass} w-auto`}
              >
                <option value="">{lang === 'fr' ? 'Toutes catégories' : 'All Categories'}</option>
                {SUBJECT_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {localizeName(lang, c.labelFr, c.labelEn)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const importable = filteredLibrary
                  .filter((item) => !existingCodesSet.has(item.code.toUpperCase()))
                  .map((item) => item.code);
                const allSelected = importable.every((c) => selectedCodes.includes(c));
                if (allSelected) {
                  setSelectedCodes((prev) => prev.filter((c) => !importable.includes(c)));
                } else {
                  setSelectedCodes((prev) => Array.from(new Set([...prev, ...importable])));
                }
              }}
            >
              {lang === 'fr' ? 'Tout sélectionner (vue filtrée)' : 'Select All in View'}
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
            {filteredLibrary.map((item) => {
              const alreadyAdded = existingCodesSet.has(item.code.toUpperCase());
              const checked = selectedCodes.includes(item.code);
              return (
                <label
                  key={item.code}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                    alreadyAdded
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 opacity-60'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      disabled={alreadyAdded}
                      checked={alreadyAdded || checked}
                      onChange={() =>
                        setSelectedCodes((prev) =>
                          prev.includes(item.code)
                            ? prev.filter((c) => c !== item.code)
                            : [...prev, item.code]
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#0F2744]"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        <span className="font-mono-tabular text-[#1E40AF] dark:text-blue-400 mr-2">
                          {item.code}
                        </span>
                        {localizeName(lang, item.nameFr, item.nameEn)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {lang === 'fr' ? item.nameEn : item.nameFr} · {item.category} ·{' '}
                        {item.levelScope}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono-tabular text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {alreadyAdded
                        ? lang === 'fr'
                          ? 'Déjà ajoutée'
                          : 'Added'
                        : `Coeff ${item.suggestedCoeff}`}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-mono-tabular text-slate-500">
              {selectedCodes.length} {lang === 'fr' ? 'sélectionnée(s)' : 'selected'}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowLibrary(false)}>
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </Button>
              <Button
                variant="primary"
                disabled={importingLib || selectedCodes.length === 0}
                onClick={handleImportLibrary}
              >
                <Check className="h-4 w-4" />
                <span>
                  {importingLib
                    ? '...'
                    : lang === 'fr'
                    ? 'Importer la sélection'
                    : 'Import Selected'}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </ModalDialog>

      {/* Bulk Assign Subjects to Classes Modal */}
      <ModalDialog
        open={showBulkAssign}
        onClose={() => setShowBulkAssign(false)}
        maxWidth="max-w-3xl"
        title={
          lang === 'fr'
            ? 'Affectation en masse Matières ↔ Classes'
            : 'Bulk Assign Subjects to Classes'
        }
      >
        <form onSubmit={handleBulkAssign} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Classes cibles' : 'Target Classes'}
              </label>
              <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1">
                {(data.classes || []).map((c: any) => (
                  <label key={c.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkClassIds.includes(c.id)}
                      onChange={() =>
                        setBulkClassIds((prev) =>
                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        )
                      }
                    />
                    <span>{localizeName(lang, c.name, c.nameEn)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Matières à assigner' : 'Subjects to Assign'}
              </label>
              <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1">
                {(data.subjects || []).map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkSubjectIds.includes(s.id)}
                      onChange={() =>
                        setBulkSubjectIds((prev) =>
                          prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )
                      }
                    />
                    <span>
                      <span className="font-mono-tabular font-semibold mr-1">{s.code}</span>
                      {localizeName(lang, s.nameFr || s.name, s.nameEn)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Enseignant (optionnel)' : 'Teacher (optional)'}
              </label>
              <select
                value={bulkTeacherId}
                onChange={(e) => setBulkTeacherId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Non assigné' : 'Unassigned'}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Heures / semaine' : 'Weekly Hours'}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={bulkHours}
                onChange={(e) => setBulkHours(Number(e.target.value))}
                className={`mt-1 font-mono-tabular ${inputBaseClass}`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBulkAssign(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={bulkSaving || bulkClassIds.length === 0 || bulkSubjectIds.length === 0}
            >
              {bulkSaving
                ? '...'
                : lang === 'fr'
                ? 'Appliquer les affectations'
                : 'Apply Bulk Assignments'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Custom CSV / JSON Import Modal */}
      <ModalDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        title={lang === 'fr' ? 'Importer des matières (CSV ou JSON)' : 'Import Subjects (CSV or JSON)'}
      >
        <form onSubmit={handleCustomImport} className="space-y-4 text-xs">
          <AlertBanner type="info">
            {lang === 'fr'
              ? 'Collez des lignes CSV (Code,Nom Français,English Name,Catégorie,Cycle,Coeff) ou un tableau JSON.'
              : 'Paste CSV lines (Code,French Name,English Name,Category,Level,Coeff) or a JSON array.'}
          </AlertBanner>
          <textarea
            rows={7}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className={`font-mono-tabular ${inputBaseClass}`}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImport(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" disabled={importingCustom}>
              {importingCustom ? '...' : lang === 'fr' ? 'Importer' : 'Import'}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
