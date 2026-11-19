import React, { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  BookOpen,
  Wallet,
  AlertCircle,
  Calendar,
  Sparkles,
  QrCode,
  Plus,
  MessageSquare,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import {
  SurfaceCard,
  PageHeader,
  Button,
  AlertBanner,
  AnimatedNumber,
} from '../ui/DesignSystem.tsx';

interface DashboardData {
  kpis: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalRevenue: number;
    totalBilled: number;
    outstandingFees: number;
  };
  attendanceStats: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  };
  recentPayments: {
    id: number;
    receiptNumber: string;
    studentName: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
  }[];
  recentActivities: {
    id: number;
    actorName: string;
    action: string;
    entityType: string;
    details: string;
    createdAt: string;
  }[];
  upcomingExams: {
    id: number;
    title: string;
    examDate: string;
    status: string;
  }[];
  performanceByClass: {
    classId: number;
    className: string;
    enrolled: number;
    averageOutOf20: number;
    gradesCount: number;
  }[];
  monthlyRevenue: { month: string; amount: number }[];
}

export const DashboardView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { school, lang, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<DashboardData>('/api/schools/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      await apiRequest('/api/schools/seed-curriculum', { method: 'POST' });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-72 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:col-span-7" />
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <AlertBanner type="error">{error || 'Erreur de chargement.'}</AlertBanner>;
  }

  const currency = school?.currency || 'XOF';
  const maxRevenue = Math.max(1, ...data.monthlyRevenue.map((m) => m.amount));

  const quickActions = [
    {
      id: 'students',
      label: lang === 'fr' ? 'Inscrire un élève' : 'Enroll Student',
      icon: Plus,
      roles: ['super_admin', 'school_admin', 'teacher'],
    },
    {
      id: 'attendance',
      label: lang === 'fr' ? 'Scanner QR Présence' : 'QR Attendance Scan',
      icon: QrCode,
      roles: ['super_admin', 'school_admin', 'teacher'],
    },
    {
      id: 'finance',
      label: lang === 'fr' ? 'Encaisser frais' : 'Record Payment',
      icon: Wallet,
      roles: ['super_admin', 'school_admin', 'accountant'],
    },
    {
      id: 'timetable',
      label: lang === 'fr' ? 'Emploi du temps' : 'Timetable',
      icon: CalendarDays,
      roles: ['super_admin', 'school_admin', 'teacher'],
    },
    {
      id: 'communication',
      label: lang === 'fr' ? 'Publier annonce' : 'Post Announcement',
      icon: MessageSquare,
      roles: ['super_admin', 'school_admin', 'accountant', 'teacher'],
    },
  ].filter((q) => user && q.roles.includes(user.role));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          lang === 'fr'
            ? `Bonjour, ${user?.fullName?.split(' ')[0] || 'Direction'}`
            : `Welcome back, ${user?.fullName?.split(' ')[0] || 'Admin'}`
        }
        subtitle={
          <>
            {school?.name} · {school?.city}, {school?.country} · Code :{' '}
            <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-300">
              {school?.code}
            </span>
          </>
        }
        actions={
          data.kpis.totalStudents === 0 &&
          (user?.role === 'school_admin' || user?.role === 'super_admin') ? (
            <Button onClick={handleSeedSample} disabled={seeding} variant="primary">
              <Sparkles className="h-4 w-4" />
              <span>
                {seeding
                  ? lang === 'fr'
                    ? 'Initialisation...'
                    : 'Populating...'
                  : lang === 'fr'
                  ? 'Charger un jeu de données modèle'
                  : 'Load Sample School Data'}
              </span>
            </Button>
          ) : undefined
        }
      />

      {/* Quick Actions Strip */}
      {quickActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => onNavigate(act.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#1E40AF]/50 hover:text-[#1E40AF] dark:hover:text-blue-400 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Icon className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-[#1E40AF]/40 dark:hover:border-blue-600/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">{lang === 'fr' ? 'Élèves actifs' : 'Students'}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1E40AF] dark:text-blue-400">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">
              <AnimatedNumber value={data.kpis.totalStudents} />
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1E40AF] transition-colors" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('teachers')}
          className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-[#1E40AF]/40 dark:hover:border-blue-600/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">{lang === 'fr' ? 'Enseignants' : 'Teachers'}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F2744] dark:text-slate-200">
              <UserCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">
              <AnimatedNumber value={data.kpis.totalTeachers} />
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1E40AF] transition-colors" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('academics')}
          className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-[#1E40AF]/40 dark:hover:border-blue-600/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">{lang === 'fr' ? 'Classes' : 'Classes'}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0F2744] dark:text-slate-200">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">
              <AnimatedNumber value={data.kpis.totalClasses} />
            </p>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#1E40AF] transition-colors" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-emerald-400/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">
              {lang === 'fr' ? 'Recettes encaissées' : 'Total Revenue'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono-tabular text-xl font-bold text-emerald-700 dark:text-emerald-400">
            <AnimatedNumber
              value={data.kpis.totalRevenue}
              formatter={(v) => formatCurrency(v, currency)}
            />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="group rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-amber-400/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">
              {lang === 'fr' ? 'Frais impayés' : 'Outstanding Fees'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 font-mono-tabular text-xl font-bold text-amber-700 dark:text-amber-400">
            <AnimatedNumber
              value={data.kpis.outstandingFees}
              formatter={(v) => formatCurrency(v, currency)}
            />
          </p>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Monthly Revenue Chart */}
        <SurfaceCard className="lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr' ? 'Encaissements mensuels' : 'Monthly Fee Collections'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'fr'
                  ? 'Paiements enregistrés en base de données'
                  : 'Recorded tuition & fee payments'}
              </p>
            </div>
            <span className="font-mono-tabular text-xs font-semibold text-slate-600 dark:text-slate-300">
              {currency}
            </span>
          </div>

          {data.monthlyRevenue.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-xs text-slate-400">
              {lang === 'fr'
                ? 'Aucun paiement enregistré pour générer le graphique.'
                : 'No payment records available yet.'}
            </div>
          ) : (
            <div className="mt-6">
              <div className="relative flex h-48 items-end gap-3 sm:gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                {data.monthlyRevenue.map((item, idx) => {
                  const pct = Math.max(8, Math.round((item.amount / maxRevenue) * 100));
                  return (
                    <div
                      key={item.month}
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                      className="relative flex flex-1 flex-col items-center justify-end h-full"
                    >
                      {hoveredBar === idx && (
                        <div className="absolute -top-8 z-10 whitespace-nowrap rounded-lg bg-[#0F2744] dark:bg-slate-800 px-2.5 py-1 font-mono-tabular text-[11px] font-semibold text-white shadow-md">
                          {formatCurrency(item.amount, currency)}
                        </div>
                      )}
                      <div
                        className="w-full max-w-[54px] rounded-t-lg bg-[#0F2744] dark:bg-blue-600 transition-all duration-200 hover:bg-[#1E40AF] dark:hover:bg-blue-500"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-3 sm:gap-4">
                {data.monthlyRevenue.map((item) => (
                  <div
                    key={item.month}
                    className="flex-1 text-center font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    {item.month}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SurfaceCard>

        {/* Attendance & Academic Performance */}
        <div className="flex flex-col justify-between gap-6 lg:col-span-5">
          <SurfaceCard>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
                {lang === 'fr' ? 'Statistiques de présence' : 'Attendance Statistics'}
              </h2>
              <span className="font-mono-tabular text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {data.attendanceStats.rate}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, data.attendanceStats.rate)}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2.5 text-center">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <p className="font-mono-tabular text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {data.attendanceStats.present}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'fr' ? 'Présents' : 'Present'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <p className="font-mono-tabular text-base font-bold text-amber-700 dark:text-amber-400">
                  {data.attendanceStats.late}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'fr' ? 'Retards' : 'Late'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <p className="font-mono-tabular text-base font-bold text-red-700 dark:text-red-400">
                  {data.attendanceStats.absent}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'fr' ? 'Absents' : 'Absent'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-2.5">
                <p className="font-mono-tabular text-base font-bold text-slate-700 dark:text-slate-300">
                  {data.attendanceStats.excused}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === 'fr' ? 'Excusés' : 'Excused'}
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Performance académique par classe' : 'Class Academic Performance'}
            </h2>
            {data.performanceByClass.length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">
                {lang === 'fr' ? 'Aucune classe configurée.' : 'No classes configured yet.'}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.performanceByClass.slice(0, 5).map((cls) => (
                  <div key={cls.classId}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cls.className} ({cls.enrolled} {lang === 'fr' ? 'élèves' : 'students'})
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                        {cls.gradesCount > 0 ? `${cls.averageOutOf20.toFixed(2)} / 20` : '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-[#1E40AF] dark:bg-blue-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, (cls.averageOutOf20 / 20) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>

      {/* Bottom Row: Recent Payments, Upcoming Exams, Recent Activities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SurfaceCard>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Paiements récents' : 'Recent Payments'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
            >
              {lang === 'fr' ? 'Voir tout' : 'View all'}
            </button>
          </div>
          {data.recentPayments.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              {lang === 'fr' ? 'Aucun encaissement récent.' : 'No payments recorded.'}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {p.studentName}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                      {p.receiptNumber} · {p.paidAt}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                    {formatCurrency(p.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Examens & Évaluations' : 'Upcoming Examinations'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('exams')}
              className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
            >
              {lang === 'fr' ? 'Gérer' : 'Manage'}
            </button>
          </div>
          {data.upcomingExams.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              {lang === 'fr' ? 'Aucun examen planifié.' : 'No examinations scheduled.'}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcomingExams.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {ex.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3 w-3" />
                      <span>{ex.examDate}</span>
                    </p>
                  </div>
                  <span className="font-medium text-slate-600 dark:text-slate-300 capitalize shrink-0">
                    {ex.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
            {lang === 'fr' ? 'Activités récentes' : 'Recent Activities'}
          </h2>
          {data.recentActivities.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400">
              {lang === 'fr' ? 'Aucune activité récente.' : 'No recent activities.'}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentActivities.slice(0, 6).map((act) => (
                <div key={act.id} className="py-2.5 text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {act.action} ·{' '}
                    <span className="font-normal text-slate-600 dark:text-slate-400">
                      {act.actorName}
                    </span>
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">{act.details}</p>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};
