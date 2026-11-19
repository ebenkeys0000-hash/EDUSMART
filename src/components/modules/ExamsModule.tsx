import React, { useEffect, useState } from 'react';
import { Award, BarChart3, FileText, Plus, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportReportCardPdf, exportTableToPdf } from '../../lib/exports.ts';
import { localizeName } from '../../lib/africanCurriculumCatalog.ts';
import {
  AlertBanner,
  Button,
  PageHeader,
  SegmentedTabs,
  SurfaceCard,
  inputBaseClass,
} from '../ui/DesignSystem.tsx';

export const ExamsModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [tab, setTab] = useState<'exams' | 'grades' | 'report_cards' | 'analytics'>('exams');
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [gradingScale, setGradingScale] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [examClassId, setExamClassId] = useState('');
  const [examTermId, setExamTermId] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));

  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [gradeRows, setGradeRows] = useState<any[]>([]);
  const [resolvedCoeff, setResolvedCoeff] = useState<number>(1);

  const [rankings, setRankings] = useState<any[]>([]);
  const [classAverage, setClassAverage] = useState(0);

  // Analytics tab state
  const [analyticsYearId, setAnalyticsYearId] = useState('');
  const [analyticsTermId, setAnalyticsTermId] = useState('');
  const [analyticsData, setAnalyticsData] = useState<{
    gradingScale: number;
    studentRankings: any[];
    seriesPerformance: any[];
  } | null>(null);

  const loadMeta = async () => {
    const [exRes, acadRes] = await Promise.all([
      apiRequest<{ items: any[] }>('/api/exams'),
      apiRequest<any>('/api/academics/structure'),
    ]);
    setExams(exRes.items || []);
    setClasses(acadRes.classes || []);
    setSubjects(acadRes.subjects || []);
    setTerms(acadRes.terms || []);
    setYears(acadRes.academicYears || []);
    if (acadRes.curriculumProfile?.gradingScale) {
      setGradingScale(acadRes.curriculumProfile.gradingScale);
    }
    if (exRes.items?.[0] && !selectedExamId) setSelectedExamId(String(exRes.items[0].id));
    if (acadRes.classes?.[0] && !selectedClassId) {
      setSelectedClassId(String(acadRes.classes[0].id));
      setExamClassId(String(acadRes.classes[0].id));
    }
    if (acadRes.subjects?.[0] && !selectedSubjectId) {
      setSelectedSubjectId(String(acadRes.subjects[0].id));
    }
    if (acadRes.terms?.[0] && !examTermId) setExamTermId(String(acadRes.terms[0].id));
  };

  useEffect(() => {
    loadMeta().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (tab !== 'grades' || !selectedExamId || !selectedClassId || !selectedSubjectId) return;
    apiRequest<{ items: any[]; resolvedCoefficient?: number }>(
      `/api/exams/grades?examinationId=${selectedExamId}&classId=${selectedClassId}&subjectId=${selectedSubjectId}`
    ).then((res) => {
      setGradeRows(res.items || []);
      if (res.resolvedCoefficient) setResolvedCoeff(res.resolvedCoefficient);
    });
  }, [tab, selectedExamId, selectedClassId, selectedSubjectId]);

  useEffect(() => {
    if (tab !== 'report_cards' || !selectedExamId || !selectedClassId) return;
    apiRequest<{ rankings: any[]; classAverage: number; gradingScale?: number }>(
      `/api/exams/report-cards?examinationId=${selectedExamId}&classId=${selectedClassId}`
    ).then((res) => {
      setRankings(res.rankings || []);
      setClassAverage(res.classAverage || 0);
      if (res.gradingScale) setGradingScale(res.gradingScale);
    });
  }, [tab, selectedExamId, selectedClassId]);

  useEffect(() => {
    if (tab !== 'analytics') return;
    const qs = new URLSearchParams();
    if (analyticsYearId) qs.set('academicYearId', analyticsYearId);
    if (analyticsTermId) qs.set('termId', analyticsTermId);
    apiRequest<{ gradingScale: number; studentRankings: any[]; seriesPerformance: any[] }>(
      `/api/exams/analytics?${qs.toString()}`
    ).then(setAnalyticsData);
  }, [tab, analyticsYearId, analyticsTermId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/exams', {
        method: 'POST',
        body: JSON.stringify({
          title,
          classId: examClassId || null,
          termId: examTermId || null,
          maxScore: gradingScale,
          examDate,
        }),
      });
      setTitle('');
      await loadMeta();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveGrades = async () => {
    setError(null);
    setNotice(null);
    try {
      await apiRequest('/api/exams/grades/batch', {
        method: 'POST',
        body: JSON.stringify({
          examinationId: Number(selectedExamId),
          classId: Number(selectedClassId),
          subjectId: Number(selectedSubjectId),
          maxScore: gradingScale,
          entries: gradeRows,
        }),
      });
      setNotice(
        lang === 'fr'
          ? 'Notes enregistrées avec instantané du coefficient et moyennes recalculées.'
          : 'Grades saved with coefficient snapshot and averages recalculated.'
      );
      await loadMeta();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Examens, Notes & Bulletins' : 'Examinations & Report Cards'}
        subtitle={
          <>
            <span className="font-mono-tabular font-semibold">{exams.length}</span>{' '}
            {lang === 'fr'
              ? `sessions · Calcul pondéré (Barème / ${gradingScale}) & export PDF`
              : `sessions · Weighted grading (Scale / ${gradingScale}) & PDF export`}
          </>
        }
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'exams', label: lang === 'fr' ? 'Examens' : 'Exams' },
              { id: 'grades', label: lang === 'fr' ? 'Saisie des notes' : 'Enter Grades' },
              {
                id: 'report_cards',
                label: lang === 'fr' ? 'Classements & Bulletins' : 'Rankings & Cards',
              },
              {
                id: 'analytics',
                label: lang === 'fr' ? 'Trimestres & Séries' : 'Term & Series Analytics',
                icon: <BarChart3 className="h-3.5 w-3.5" />,
              },
            ]}
          />
        }
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}
      {notice && <AlertBanner type="success">{notice}</AlertBanner>}

      {tab === 'exams' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SurfaceCard className="lg:col-span-4 h-fit">
            <form onSubmit={handleCreateExam} className="space-y-3 text-xs">
              <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr' ? 'Planifier un examen' : 'Schedule Examination'}
              </h2>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'fr' ? 'ex: Composition Trimestre 1' : 'e.g. Term 1 Exam'}
                className={inputBaseClass}
              />
              <select
                value={examClassId}
                onChange={(e) => setExamClassId(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">{lang === 'fr' ? 'Toutes les classes' : 'All classes'}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localizeName(lang, c.name, c.nameEn)}
                  </option>
                ))}
              </select>
              <select
                value={examTermId}
                onChange={(e) => setExamTermId(e.target.value)}
                className={inputBaseClass}
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={inputBaseClass}
              />
              <Button type="submit" variant="primary" className="w-full">
                <Plus className="h-4 w-4" />
                <span>{lang === 'fr' ? "Créer l'examen" : 'Create Exam'}</span>
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden lg:col-span-8">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    {lang === 'fr' ? 'Intitulé' : 'Title'}
                  </th>
                  <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Classe' : 'Class'}</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Statut' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {exams.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {ex.title}
                      {ex.academicYearName && (
                        <span className="ml-2 font-mono-tabular text-[11px] font-normal text-slate-400">
                          {ex.academicYearName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {localizeName(lang, ex.className, ex.classNameEn)}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular">{ex.examDate}</td>
                    <td className="px-4 py-3 capitalize">{ex.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SurfaceCard>
        </div>
      )}

      {tab === 'grades' && (
        <div className="space-y-4">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className={`${inputBaseClass} w-auto min-w-[180px]`}
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={`${inputBaseClass} w-auto min-w-[140px]`}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localizeName(lang, c.name, c.nameEn)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className={`${inputBaseClass} w-auto min-w-[160px]`}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {localizeName(lang, s.nameFr || s.name, s.nameEn)}
                    </option>
                  ))}
                </select>
                <span className="font-mono-tabular text-[11px] font-semibold text-[#1E40AF] dark:text-blue-400">
                  {lang === 'fr' ? 'Coeff appliqué :' : 'Effective Coeff:'} {resolvedCoeff}
                </span>
              </div>
              <Button variant="primary" onClick={handleSaveGrades}>
                <Save className="h-4 w-4" />
                <span>{lang === 'fr' ? 'Enregistrer les notes' : 'Save Grades'}</span>
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Matricule' : 'Student ID'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Élève' : 'Student'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? `Note / ${gradingScale}` : `Score / ${gradingScale}`}
                    </th>
                    <th className="px-4 py-3 font-semibold">Coeff</th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Appréciation' : 'Comment'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gradeRows.map((row, idx) => (
                    <tr key={row.studentId}>
                      <td className="px-4 py-3 font-mono-tabular">{row.registrationNumber}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {row.studentName}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.25"
                          min={0}
                          max={gradingScale}
                          value={row.score}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGradeRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, score: val } : r))
                            );
                          }}
                          className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 font-mono-tabular text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono-tabular">{row.coefficient}</td>
                      <td className="px-4 py-3">
                        <input
                          value={row.teacherComment}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGradeRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, teacherComment: val } : r))
                            );
                          }}
                          placeholder={lang === 'fr' ? 'Observation...' : 'Remark...'}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-slate-900 dark:text-slate-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      )}

      {tab === 'report_cards' && (
        <div className="space-y-4">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className={`${inputBaseClass} w-auto min-w-[180px]`}
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className={`${inputBaseClass} w-auto min-w-[140px]`}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localizeName(lang, c.name, c.nameEn)}
                    </option>
                  ))}
                </select>
                <span className="font-semibold text-[#0F2744] dark:text-white">
                  {lang === 'fr' ? 'Moyenne de la classe :' : 'Class Average:'}{' '}
                  <span className="font-mono-tabular text-[#1E40AF] dark:text-blue-400">
                    {classAverage.toFixed(2)} / {gradingScale}
                  </span>
                </span>
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  exportTableToPdf(
                    lang === 'fr' ? 'Palmarès & Classement Académique' : 'Academic Merit List',
                    `${lang === 'fr' ? 'Moyenne classe' : 'Class average'} : ${classAverage.toFixed(2)} / ${gradingScale}`,
                    ['Rang', 'Matricule', 'Élève', `Moyenne /${gradingScale}`, 'Mention'],
                    rankings.map((r) => [
                      `${r.rank}e`,
                      r.registrationNumber,
                      r.studentName,
                      r.average.toFixed(2),
                      r.mention,
                    ]),
                    'EDUSMART_Classement',
                    school?.name
                  )
                }
              >
                <Award className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
                <span>{lang === 'fr' ? 'Exporter Palmarès PDF' : 'Export Rankings PDF'}</span>
              </Button>
            </div>
          </SurfaceCard>

          <SurfaceCard padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Rang' : 'Rank'}</th>
                    <th className="px-4 py-3 font-semibold">{lang === 'fr' ? 'Élève' : 'Student'}</th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Matières notées' : 'Graded Subjects'}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {lang === 'fr' ? 'Moyenne pondérée' : 'Weighted Average'}
                    </th>
                    <th className="px-4 py-3 font-semibold">Mention</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      {lang === 'fr' ? 'Bulletin PDF' : 'Report PDF'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rankings.map((rc) => (
                    <tr key={rc.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                        {rc.rank}e
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {rc.studentName}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                          {rc.registrationNumber}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular">{rc.subjects.length}</td>
                      <td className="px-4 py-3 font-mono-tabular font-bold text-[#1E40AF] dark:text-blue-400">
                        {rc.average.toFixed(2)} / {rc.gradingScale || gradingScale}
                      </td>
                      <td className="px-4 py-3 font-medium">{rc.mention}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            exportReportCardPdf(
                              {
                                ...rc,
                                className: localizeName(lang, rc.className, rc.classNameEn),
                                subjects: rc.subjects.map((sub: any) => ({
                                  ...sub,
                                  subjectName: localizeName(
                                    lang,
                                    sub.subjectNameFr || sub.subjectName,
                                    sub.subjectNameEn
                                  ),
                                })),
                              },
                              {
                                name: school?.name || 'EDUSMART',
                                city: school?.city,
                                country: school?.country,
                              },
                              rankings.length
                            )
                          }
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>{lang === 'fr' ? 'Bulletin PDF' : 'Report PDF'}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-5">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select
                value={analyticsYearId}
                onChange={(e) => setAnalyticsYearId(e.target.value)}
                className={`${inputBaseClass} w-auto min-w-[160px]`}
              >
                <option value="">{lang === 'fr' ? 'Toutes les années (Annuel)' : 'All Years (Annual)'}</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              <select
                value={analyticsTermId}
                onChange={(e) => setAnalyticsTermId(e.target.value)}
                className={`${inputBaseClass} w-auto min-w-[180px]`}
              >
                <option value="">{lang === 'fr' ? 'Tous les trimestres (Moyenne Annuelle)' : 'All Terms (Annual Average)'}</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <SurfaceCard className="lg:col-span-4 space-y-3 text-xs">
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr'
                  ? 'Performance par Série & Filière'
                  : 'Performance by Educational Series'}
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(analyticsData?.seriesPerformance || []).length === 0 ? (
                  <p className="py-4 text-slate-400">
                    {lang === 'fr' ? 'Aucune note enregistrée sur cette période.' : 'No graded records for this period.'}
                  </p>
                ) : (
                  analyticsData?.seriesPerformance.map((sp: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {localizeName(lang, sp.seriesNameFr, sp.seriesNameEn)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          <span className="font-mono-tabular">{sp.studentCount}</span>{' '}
                          {lang === 'fr' ? 'élève(s) évalué(s)' : 'evaluated student(s)'}
                        </p>
                      </div>
                      <span className="font-mono-tabular font-bold text-[#1E40AF] dark:text-blue-400">
                        {sp.average.toFixed(2)} / {analyticsData?.gradingScale || gradingScale}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard padding="none" className="lg:col-span-8 overflow-hidden">
              <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                  {lang === 'fr'
                    ? 'Classement Pondéré (Trimestriel / Annuel)'
                    : 'Weighted Term / Annual Student Rankings'}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">{lang === 'fr' ? 'Élève' : 'Student'}</th>
                      <th className="px-4 py-2.5 font-semibold">{lang === 'fr' ? 'Classe' : 'Class'}</th>
                      <th className="px-4 py-2.5 font-semibold">{lang === 'fr' ? 'Série' : 'Series'}</th>
                      <th className="px-4 py-2.5 text-right font-semibold">{lang === 'fr' ? 'Moyenne' : 'Average'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(analyticsData?.studentRankings || []).map((st: any, idx: number) => (
                      <tr key={st.studentId}>
                        <td className="px-4 py-2.5 font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                          {idx + 1}e
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {st.studentName}
                        </td>
                        <td className="px-4 py-2.5">
                          {localizeName(lang, st.className, st.classNameEn)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {localizeName(lang, st.seriesNameFr, st.seriesNameEn)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-tabular font-bold text-[#1E40AF] dark:text-blue-400">
                          {st.average.toFixed(2)} / {analyticsData?.gradingScale || gradingScale}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}
    </div>
  );
};
