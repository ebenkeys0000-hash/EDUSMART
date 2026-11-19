import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Download,
  FileSpreadsheet,
  GitBranch,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api.ts';
import { exportToExcel } from '../../../lib/exports.ts';
import { localizeName } from '../../../lib/africanCurriculumCatalog.ts';
import {
  AlertBanner,
  Button,
  ModalDialog,
  SurfaceCard,
  inputBaseClass,
} from '../../ui/DesignSystem.tsx';

interface SeriesTabProps {
  lang: 'fr' | 'en';
  data: any;
  onRefresh: () => Promise<void>;
  onError: (msg: string | null) => void;
  onNotice: (msg: string | null) => void;
}

export const SeriesAndTracksTab: React.FC<SeriesTabProps> = ({
  lang,
  data,
  onRefresh,
  onError,
  onNotice,
}) => {
  const [loadingStarter, setLoadingStarter] = useState(false);

  const [serCode, setSerCode] = useState('');
  const [serFr, setSerFr] = useState('');
  const [serEn, setSerEn] = useState('');
  const [serCat, setSerCat] = useState('scientific');
  const [serScope, setSerScope] = useState('senior_secondary');
  const [serDesc, setSerDesc] = useState('');

  const [trkCode, setTrkCode] = useState('');
  const [trkFr, setTrkFr] = useState('');
  const [trkEn, setTrkEn] = useState('');
  const [trkSector, setTrkSector] = useState('engineering');
  const [trkSeriesId, setTrkSeriesId] = useState('');
  const [trkDesc, setTrkDesc] = useState('');

  const loadStarterPack = async () => {
    setLoadingStarter(true);
    onError(null);
    onNotice(null);
    try {
      const res = await apiRequest<{
        createdSeriesCount: number;
        createdSpecializationsCount: number;
      }>('/api/academics/series/starter', {
        method: 'POST',
        body: JSON.stringify({ includeSeries: true, includeTracks: true }),
      });
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? `${res.createdSeriesCount} série(s) et ${res.createdSpecializationsCount} filière(s) techniques/professionnelles ajoutées.`
          : `${res.createdSeriesCount} series and ${res.createdSpecializationsCount} technical/vocational tracks loaded.`
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoadingStarter(false);
    }
  };

  const createSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    try {
      await apiRequest('/api/academics/series', {
        method: 'POST',
        body: JSON.stringify({
          code: serCode,
          nameFr: serFr,
          nameEn: serEn || serFr,
          category: serCat,
          levelScope: serScope,
          descriptionFr: serDesc,
          descriptionEn: serDesc,
        }),
      });
      setSerCode('');
      setSerFr('');
      setSerEn('');
      setSerDesc('');
      await onRefresh();
      onNotice(lang === 'fr' ? 'Série créée.' : 'Series created.');
    } catch (err: any) {
      onError(err.message);
    }
  };

  const createTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    try {
      await apiRequest('/api/academics/specializations', {
        method: 'POST',
        body: JSON.stringify({
          code: trkCode,
          nameFr: trkFr,
          nameEn: trkEn || trkFr,
          sector: trkSector,
          seriesId: trkSeriesId ? Number(trkSeriesId) : null,
          descriptionFr: trkDesc,
          descriptionEn: trkDesc,
        }),
      });
      setTrkCode('');
      setTrkFr('');
      setTrkEn('');
      setTrkDesc('');
      await onRefresh();
      onNotice(lang === 'fr' ? 'Filière créée.' : 'Specialization track created.');
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F2744] dark:bg-[#1E40AF] text-white shrink-0">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr'
                  ? 'Séries Éducatives & Filières Techniques / Professionnelles'
                  : 'Educational Series & Technical / Vocational Tracks'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'fr'
                  ? 'Chargez les séries standards (A, C, D, Scientifique, Littéraire, Économique, Technique, Pro) et les 14 filières TVET, ou créez les vôtres.'
                  : 'Load starter series (A, C, D, Scientific, Literary, Economic, Technical, Vocational) and 14 TVET tracks, or add custom tracks.'}
              </p>
            </div>
          </div>

          <Button variant="primary" disabled={loadingStarter} onClick={loadStarterPack}>
            <Sparkles className="h-4 w-4" />
            <span>
              {loadingStarter
                ? '...'
                : lang === 'fr'
                ? 'Charger Séries & 14 Filières TVET'
                : 'Load Series & 14 Vocational Tracks'}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Academic Series */}
        <SurfaceCard className="space-y-4 text-xs">
          <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
            {lang === 'fr' ? 'Séries Académiques' : 'Academic Series'} (
            <span className="font-mono-tabular">{(data.academicSeries || []).length}</span>)
          </h3>

          <form onSubmit={createSeries} className="space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                required
                value={serCode}
                onChange={(e) => setSerCode(e.target.value)}
                placeholder="Code (SER-E)"
                className={`uppercase font-mono-tabular ${inputBaseClass}`}
              />
              <select
                value={serCat}
                onChange={(e) => setSerCat(e.target.value)}
                className={inputBaseClass}
              >
                <option value="scientific">{lang === 'fr' ? 'Scientifique' : 'Scientific'}</option>
                <option value="literary">{lang === 'fr' ? 'Littéraire' : 'Literary'}</option>
                <option value="economic">{lang === 'fr' ? 'Économique' : 'Economic'}</option>
                <option value="technical">{lang === 'fr' ? 'Technique' : 'Technical'}</option>
                <option value="vocational">{lang === 'fr' ? 'Professionnelle' : 'Vocational'}</option>
                <option value="general">{lang === 'fr' ? 'Général' : 'General'}</option>
              </select>
              <select
                value={serScope}
                onChange={(e) => setSerScope(e.target.value)}
                className={inputBaseClass}
              >
                <option value="senior_secondary">{lang === 'fr' ? 'Lycée' : 'Senior Sec.'}</option>
                <option value="technical_vocational">{lang === 'fr' ? 'Tech & Pro' : 'Tech & TVET'}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={serFr}
                onChange={(e) => setSerFr(e.target.value)}
                placeholder={lang === 'fr' ? 'Intitulé Français *' : 'French Name *'}
                className={inputBaseClass}
              />
              <input
                value={serEn}
                onChange={(e) => setSerEn(e.target.value)}
                placeholder="English Name"
                className={inputBaseClass}
              />
            </div>
            <div className="flex gap-2">
              <input
                value={serDesc}
                onChange={(e) => setSerDesc(e.target.value)}
                placeholder={lang === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
                className={inputBaseClass}
              />
              <Button type="submit" variant="outline">
                <Plus className="h-4 w-4" />
                <span>{lang === 'fr' ? 'Ajouter' : 'Add'}</span>
              </Button>
            </div>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {(data.academicSeries || []).length === 0 ? (
              <p className="py-6 text-center text-slate-400">
                {lang === 'fr'
                  ? 'Aucune série configurée. Cliquez sur "Charger Séries & 14 Filières TVET".'
                  : 'No series configured yet. Click Load Series above.'}
              </p>
            ) : (
              (data.academicSeries || []).map((s: any) => (
                <div key={s.id} className="flex items-start justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      <span className="font-mono-tabular text-[#1E40AF] dark:text-blue-400 mr-2">
                        {s.code}
                      </span>
                      {localizeName(lang, s.nameFr, s.nameEn)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {s.category} · {localizeName(lang, s.descriptionFr, s.descriptionEn)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/academics/series/${s.id}`, { method: 'DELETE' });
                      await onRefresh();
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        {/* Technical & Vocational Specializations */}
        <SurfaceCard className="space-y-4 text-xs">
          <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
            {lang === 'fr' ? 'Spécialisations Techniques & TVET' : 'Technical & Vocational Tracks'} (
            <span className="font-mono-tabular">{(data.specializations || []).length}</span>)
          </h3>

          <form onSubmit={createTrack} className="space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                required
                value={trkCode}
                onChange={(e) => setTrkCode(e.target.value)}
                placeholder="Code (TRK-IT)"
                className={`uppercase font-mono-tabular ${inputBaseClass}`}
              />
              <select
                value={trkSector}
                onChange={(e) => setTrkSector(e.target.value)}
                className={inputBaseClass}
              >
                <option value="engineering">Engineering</option>
                <option value="computing">Computing</option>
                <option value="business">Business</option>
                <option value="agriculture">Agriculture</option>
                <option value="construction">Construction</option>
                <option value="hospitality">Hospitality</option>
                <option value="creative">Fashion / Design</option>
                <option value="energy">Energy</option>
              </select>
              <select
                value={trkSeriesId}
                onChange={(e) => setTrkSeriesId(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">{lang === 'fr' ? 'Série liée (opt.)' : 'Linked series'}</option>
                {(data.academicSeries || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={trkFr}
                onChange={(e) => setTrkFr(e.target.value)}
                placeholder={lang === 'fr' ? 'Filière Français *' : 'French Track Name *'}
                className={inputBaseClass}
              />
              <input
                value={trkEn}
                onChange={(e) => setTrkEn(e.target.value)}
                placeholder="English Track Name"
                className={inputBaseClass}
              />
            </div>
            <div className="flex gap-2">
              <input
                value={trkDesc}
                onChange={(e) => setTrkDesc(e.target.value)}
                placeholder={lang === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
                className={inputBaseClass}
              />
              <Button type="submit" variant="outline">
                <Plus className="h-4 w-4" />
                <span>{lang === 'fr' ? 'Ajouter' : 'Add'}</span>
              </Button>
            </div>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
            {(data.specializations || []).length === 0 ? (
              <p className="py-6 text-center text-slate-400">
                {lang === 'fr'
                  ? 'Aucune filière spécialisée configurée.'
                  : 'No vocational specializations configured yet.'}
              </p>
            ) : (
              (data.specializations || []).map((sp: any) => (
                <div key={sp.id} className="flex items-start justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      <span className="font-mono-tabular text-[#1E40AF] dark:text-blue-400 mr-2">
                        {sp.code}
                      </span>
                      {localizeName(lang, sp.nameFr, sp.nameEn)}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sp.sector} · {localizeName(lang, sp.descriptionFr, sp.descriptionEn)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/academics/specializations/${sp.id}`, {
                        method: 'DELETE',
                      });
                      await onRefresh();
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export const CoefficientMatrixTab: React.FC<SeriesTabProps> = ({
  lang,
  data,
  onRefresh,
  onError,
  onNotice,
}) => {
  const [filterYearId, setFilterYearId] = useState<string>(
    data.academicYears?.find((y: any) => y.isCurrent)?.id
      ? String(data.academicYears.find((y: any) => y.isCurrent).id)
      : ''
  );
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterSeriesId, setFilterSeriesId] = useState<string>('');

  const [subjectId, setSubjectId] = useState<string>(
    data.subjects?.[0] ? String(data.subjects[0].id) : ''
  );
  const [coeffVal, setCoeffVal] = useState<number>(3);
  const [weeklyHours, setWeeklyHours] = useState<number>(4);
  const [isExamSubject, setIsExamSubject] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState(
    '[{"subjectCode":"MATH","seriesCode":"SER-C","coefficient":6,"weeklyHours":6}]'
  );

  const yearMap = useMemo(
    () => new Map<number, string>((data.academicYears || []).map((y: any) => [y.id, y.name])),
    [data.academicYears]
  );
  const classMap = useMemo(
    () => new Map<number, any>((data.classes || []).map((c: any) => [c.id, c])),
    [data.classes]
  );
  const seriesMap = useMemo(
    () => new Map<number, any>((data.academicSeries || []).map((s: any) => [s.id, s])),
    [data.academicSeries]
  );
  const subjectMap = useMemo(
    () => new Map<number, any>((data.subjects || []).map((s: any) => [s.id, s])),
    [data.subjects]
  );

  const filteredRules = useMemo(() => {
    return (data.subjectCoefficients || []).filter((r: any) => {
      if (filterYearId && r.academicYearId && String(r.academicYearId) !== filterYearId) return false;
      if (filterClassId && r.classId && String(r.classId) !== filterClassId) return false;
      if (filterSeriesId && r.seriesId && String(r.seriesId) !== filterSeriesId) return false;
      return true;
    });
  }, [data.subjectCoefficients, filterYearId, filterClassId, filterSeriesId]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return;
    setSaving(true);
    onError(null);
    onNotice(null);
    try {
      await apiRequest('/api/academics/coefficients', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: filterYearId ? Number(filterYearId) : null,
          classId: filterClassId ? Number(filterClassId) : null,
          seriesId: filterSeriesId ? Number(filterSeriesId) : null,
          subjectId: Number(subjectId),
          coefficient: Number(coeffVal),
          weeklyHours: Number(weeklyHours),
          isExamSubject,
          countryCode: data.curriculumProfile?.countryCode || '',
        }),
      });
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? 'Coefficient enregistré dans la matrice (les bulletins historiques existants restent inchangés).'
          : 'Coefficient saved to matrix (historical exam report cards remain preserved).'
      );
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImportCoeffs = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    try {
      const entries = JSON.parse(importJson);
      const res = await apiRequest<{ importedCount: number }>('/api/academics/coefficients/import', {
        method: 'POST',
        body: JSON.stringify({
          entries,
          academicYearId: filterYearId ? Number(filterYearId) : null,
        }),
      });
      setShowImport(false);
      await onRefresh();
      onNotice(
        lang === 'fr'
          ? `${res.importedCount} règle(s) de coefficient importée(s).`
          : `${res.importedCount} coefficient rule(s) imported.`
      );
    } catch (err: any) {
      onError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <AlertBanner type="info">
        {lang === 'fr'
          ? 'Matrice des coefficients configurable par année académique, classe et série. Chaque note d’examen enregistre un instantané de son coefficient au moment de l’évaluation : modifier un coefficient ultérieurement ne modifie jamais les résultats passés.'
          : 'Customizable coefficient matrix by academic year, class, and series. Each saved exam grade snapshots its coefficient at evaluation time so future changes never alter historical report cards.'}
      </AlertBanner>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SurfaceCard className="lg:col-span-4 h-fit">
          <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr' ? 'Définir un coefficient' : 'Set Coefficient Rule'}
              </h3>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Année académique' : 'Academic Year'}
              </label>
              <select
                value={filterYearId}
                onChange={(e) => setFilterYearId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Toutes les années' : 'All Years'}</option>
                {(data.academicYears || []).map((y: any) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Classe (optionnel)' : 'Class (optional)'}
              </label>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Toutes les classes' : 'All Classes'}</option>
                {(data.classes || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {localizeName(lang, c.name, c.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Série / Filière (optionnel)' : 'Series (optional)'}
              </label>
              <select
                value={filterSeriesId}
                onChange={(e) => setFilterSeriesId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                <option value="">{lang === 'fr' ? 'Toutes les séries' : 'All Series'}</option>
                {(data.academicSeries || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {localizeName(lang, s.nameFr, s.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'fr' ? 'Matière *' : 'Subject *'}
              </label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className={`mt-1 ${inputBaseClass}`}
              >
                {(data.subjects || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {localizeName(lang, s.nameFr || s.name, s.nameEn)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Coefficient *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step="0.5"
                  value={coeffVal}
                  onChange={(e) => setCoeffVal(Number(e.target.value))}
                  className={`mt-1 font-mono-tabular ${inputBaseClass}`}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'fr' ? 'Heures / sem.' : 'Hours / wk'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  className={`mt-1 font-mono-tabular ${inputBaseClass}`}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isExamSubject}
                onChange={(e) => setIsExamSubject(e.target.checked)}
              />
              <span>
                {lang === 'fr'
                  ? 'Matière comptabilisée dans les examens'
                  : 'Included in weighted exam calculations'}
              </span>
            </label>

            <Button type="submit" variant="primary" disabled={saving || !subjectId} className="w-full">
              {saving ? '...' : lang === 'fr' ? 'Enregistrer le coefficient' : 'Save Coefficient'}
            </Button>
          </form>
        </SurfaceCard>

        <div className="space-y-4 lg:col-span-8">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F2744] dark:text-white">
                <span className="font-mono-tabular">{filteredRules.length}</span>{' '}
                {lang === 'fr' ? 'règle(s) active(s)' : 'configured rule(s)'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  <span>{lang === 'fr' ? 'Importer JSON' : 'Import JSON'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportToExcel(
                      filteredRules.map((r: any) => {
                        const sub = subjectMap.get(r.subjectId);
                        const cls = r.classId ? classMap.get(r.classId) : null;
                        const ser = r.seriesId ? seriesMap.get(r.seriesId) : null;
                        return {
                          Annee: r.academicYearId ? yearMap.get(r.academicYearId) : 'Toutes',
                          Classe: cls ? localizeName(lang, cls.name, cls.nameEn) : 'Toutes',
                          Serie: ser ? ser.code : 'Toutes',
                          CodeMatiere: sub?.code || '',
                          Matiere: sub ? localizeName(lang, sub.nameFr || sub.name, sub.nameEn) : '',
                          Coefficient: r.coefficient,
                          Heures: r.weeklyHours,
                        };
                      }),
                      'Coefficients',
                      'EDUSMART_Matrice_Coefficients'
                    )
                  }
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Excel</span>
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Matière' : 'Subject'}</th>
                    <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Portée (Année / Classe / Série)' : 'Scope (Year / Class / Series)'}</th>
                    <th className="px-4 py-3 font-semibold">Coeff</th>
                    <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Volume' : 'Hours'}</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        {lang === 'fr'
                          ? 'Aucune règle spécifique dans la matrice. Par défaut, les coefficients des matières s’appliquent.'
                          : 'No custom matrix rules yet. Default subject coefficients apply.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((r: any) => {
                      const sub = subjectMap.get(r.subjectId);
                      const cls = r.classId ? classMap.get(r.classId) : null;
                      const ser = r.seriesId ? seriesMap.get(r.seriesId) : null;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <span className="font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400 mr-1.5">
                              {sub?.code}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {sub ? localizeName(lang, sub.nameFr || sub.name, sub.nameEn) : `#${r.subjectId}`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {r.academicYearId ? yearMap.get(r.academicYearId) : lang === 'fr' ? 'Toutes années' : 'All years'}{' '}
                            · {cls ? localizeName(lang, cls.name, cls.nameEn) : lang === 'fr' ? 'Toutes classes' : 'All classes'}{' '}
                            · {ser ? ser.code : lang === 'fr' ? 'Toutes séries' : 'All series'}
                          </td>
                          <td className="px-4 py-3 font-mono-tabular font-bold text-[#1E40AF] dark:text-blue-400">
                            {r.coefficient}
                          </td>
                          <td className="px-4 py-3 font-mono-tabular">
                            {r.weeklyHours}h/sem
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/academics/coefficients/${r.id}`, {
                                  method: 'DELETE',
                                });
                                await onRefresh();
                              }}
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

      <ModalDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        title={lang === 'fr' ? 'Importer une matrice de coefficients (JSON)' : 'Import Coefficient Matrix (JSON)'}
      >
        <form onSubmit={handleImportCoeffs} className="space-y-4 text-xs">
          <AlertBanner type="info">
            {lang === 'fr'
              ? 'Tableau JSON avec subjectCode, seriesCode ou className, coefficient, weeklyHours.'
              : 'JSON array containing subjectCode, seriesCode or className, coefficient, weeklyHours.'}
          </AlertBanner>
          <textarea
            rows={6}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            className={`font-mono-tabular ${inputBaseClass}`}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImport(false)}>
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary">
              <Download className="h-3.5 w-3.5" />
              <span>{lang === 'fr' ? 'Importer' : 'Import'}</span>
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
