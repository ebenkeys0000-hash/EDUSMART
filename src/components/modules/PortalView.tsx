import React, { useEffect, useState } from 'react';
import { CreditCard, FileText, Receipt, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportReceiptPdf, exportReportCardPdf } from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { StudentIdCardModal } from './StudentIdCardModal.tsx';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  TableSkeleton,
} from '../ui/DesignSystem.tsx';

export const PortalView: React.FC = () => {
  const { lang, school, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showIdCard, setShowIdCard] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (stId?: string) => {
    setLoading(true);
    try {
      const url = stId ? `/api/users/portal?studentId=${stId}` : '/api/users/portal';
      const res = await apiRequest(url);
      setData(res);
      if (res.student && !selectedStudentId) setSelectedStudentId(String(res.student.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return (
      <SurfaceCard padding="none">
        <TableSkeleton rows={5} cols={4} />
      </SurfaceCard>
    );
  }

  const currency = school?.currency || 'XOF';
  const student = data.student;

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === 'fr' ? 'Portail Parent & Élève' : 'Parent & Student Portal'}
        subtitle={`Consultation des résultats, absences, factures et annonces de ${school?.name}`}
        actions={
          data.availableStudents.length > 1 ? (
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                load(e.target.value);
              }}
              className={`${inputBaseClass} w-auto min-w-[220px] font-medium`}
            >
              {data.availableStudents.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.registrationNumber})
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {!student ? (
        <SurfaceCard className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          Aucun dossier élève associé à ce compte pour le moment.
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.firstName}
                    className="h-14 w-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                    <User className="h-6 w-6" />
                  </span>
                )}
                <div>
                  <h2 className="font-display text-lg font-bold text-[#0F2744] dark:text-white">
                    {student.firstName} {student.lastName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-tabular font-semibold text-[#1E40AF] dark:text-blue-400">
                      {student.registrationNumber}
                    </span>{' '}
                    · Classe : {student.className} · Parent : {student.parentName || '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {user?.email} · Tél : {student.parentPhone || '—'} · Urgence :{' '}
                    {student.emergencyContact || '—'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="outline" onClick={() => setShowIdCard(true)}>
                  <CreditCard className="h-4 w-4 text-[#1E40AF] dark:text-blue-400" />
                  <span>{lang === 'fr' ? 'Ma Carte Scolaire (QR)' : 'School ID Card (QR)'}</span>
                </Button>

                {data.grades.length > 0 && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const totalCoeff = data.grades.reduce(
                        (s: number, g: any) => s + (g.coefficient || 1),
                        0
                      );
                      const weightedSum = data.grades.reduce(
                        (s: number, g: any) => s + g.score * (g.coefficient || 1),
                        0
                      );
                      const avg = totalCoeff > 0 ? weightedSum / totalCoeff : 0;
                      exportReportCardPdf(
                        {
                          studentName: `${student.firstName} ${student.lastName}`,
                          registrationNumber: student.registrationNumber,
                          className: student.className,
                          examinationTitle: data.grades[0]?.examTitle || 'Relevé de notes',
                          examDate: data.grades[0]?.examDate || '',
                          average: avg,
                          rank: 1,
                          mention: avg >= 14 ? 'Bien' : avg >= 10 ? 'Passable' : 'Insuffisant',
                          totalCoeff,
                          weightedSum,
                          subjects: data.grades.map((g: any) => ({
                            subjectName: g.subjectName,
                            score: g.score,
                            maxScore: g.maxScore,
                            coefficient: g.coefficient,
                            weightedPoints: g.score * g.coefficient,
                            teacherComment: g.teacherComment || '',
                          })),
                        },
                        {
                          name: school?.name || 'EDUSMART',
                          city: school?.city,
                          country: school?.country,
                        },
                        1
                      );
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Télécharger mon bulletin PDF</span>
                  </Button>
                )}
              </div>
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Academic Results */}
            <SurfaceCard>
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                Notes & Résultats scolaires
              </h3>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.grades.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {g.subjectName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {g.examTitle} · Coeff {g.coefficient}
                      </p>
                    </div>
                    <span className="font-mono-tabular font-bold text-[#1E40AF] dark:text-blue-400">
                      {g.score} / {g.maxScore}
                    </span>
                  </div>
                ))}
                {data.grades.length === 0 && (
                  <p className="py-4 text-slate-400">Aucune note publiée.</p>
                )}
              </div>
            </SurfaceCard>

            {/* Invoices & Payments */}
            <SurfaceCard>
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                Situation financière & Reçus
              </h3>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{inv.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {inv.invoiceNumber} · Échéance : {inv.dueDate}
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <p className="font-bold text-[#0F2744] dark:text-blue-400">
                        {formatCurrency(inv.paidAmount, currency)} /{' '}
                        {formatCurrency(inv.totalAmount, currency)}
                      </p>
                      <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                        {inv.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {data.payments.length > 0 && (
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Quittances téléchargeables
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.payments.map((p: any) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportReceiptPdf(
                            {
                              ...p,
                              studentName: `${student.firstName} ${student.lastName}`,
                              registrationNumber: student.registrationNumber,
                            },
                            { name: school?.name || 'EDUSMART', currency }
                          )
                        }
                      >
                        <Receipt className="h-3 w-3" />
                        <span className="font-mono-tabular">{p.receiptNumber}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </SurfaceCard>

            {/* Attendance */}
            <SurfaceCard>
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                Suivi des présences
              </h3>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.attendance.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2">
                    <span className="font-mono-tabular text-slate-700 dark:text-slate-300">
                      {a.date}
                    </span>
                    <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {a.status}
                    </span>
                  </div>
                ))}
                {data.attendance.length === 0 && (
                  <p className="py-4 text-slate-400">Aucune absence ou retard enregistré.</p>
                )}
              </div>
            </SurfaceCard>

            {/* Announcements */}
            <SurfaceCard>
              <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                Annonces de l&apos;établissement
              </h3>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.announcements.map((a: any) => (
                  <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{a.content}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </>
      )}

      {showIdCard && student && school && (
        <StudentIdCardModal
          student={student}
          school={school}
          onClose={() => setShowIdCard(false)}
        />
      )}
    </div>
  );
};
