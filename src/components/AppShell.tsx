import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  ClipboardCheck,
  Wallet,
  GraduationCap,
  CalendarDays,
  Briefcase,
  MessageSquare,
  FileSpreadsheet,
  UserCog,
  Settings,
  ShieldAlert,
  Home,
  LogOut,
  Menu,
  X,
  MailCheck,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  ArrowRight,
  CreditCard,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { translations } from '../lib/i18n.ts';
import { apiRequest } from '../lib/api.ts';
import { BrandLogo } from './ui/BrandLogo.tsx';
import { TrialCountdown } from './ui/TrialCountdown.tsx';
import { DashboardView } from './modules/DashboardView.tsx';
import { StudentsModule } from './modules/StudentsModule.tsx';
import { TeachersModule } from './modules/TeachersModule.tsx';
import { IdCardsModule } from './modules/IdCardsModule.tsx';
import { AcademicsModule } from './modules/AcademicsModule.tsx';
import { AttendanceModule } from './modules/AttendanceModule.tsx';
import { FinanceModule } from './modules/FinanceModule.tsx';
import { ExamsModule } from './modules/ExamsModule.tsx';
import { TimetableModule } from './modules/TimetableModule.tsx';
import { PayrollModule } from './modules/PayrollModule.tsx';
import { CommunicationModule } from './modules/CommunicationModule.tsx';
import { ReportsCenter } from './modules/ReportsCenter.tsx';
import { PortalView } from './modules/PortalView.tsx';
import { UsersRolesModule } from './modules/UsersRolesModule.tsx';
import { SchoolSettingsModule } from './modules/SchoolSettingsModule.tsx';
import { SuperAdminModule } from './modules/SuperAdminModule.tsx';
import { SubscriptionsModule } from './modules/SubscriptionsModule.tsx';

interface NotificationEntry {
  id: string;
  title: string;
  subtitle: string;
  targetTab: string;
  date: string;
}

interface QuickStudentResult {
  id: number;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  className?: string;
}

export const AppShell: React.FC = () => {
  const {
    user,
    school,
    subscriptionState,
    lang,
    setLang,
    logout,
    verificationCodePreview,
    setVerificationCodePreview,
    refreshSession,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = translations[lang];

  const isParentOrStudent = user?.role === 'parent' || user?.role === 'student';
  const [activeTab, setActiveTab] = useState<string>(isParentOrStudent ? 'portal' : 'dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Header Interactive States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [studentHits, setStudentHits] = useState<QuickStudentResult[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationEntry[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Email verification inline bar state
  const [verifCode, setVerifCode] = useState('');
  const [verifMsg, setVerifMsg] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const navItems = useMemo(
    () =>
      [
        {
          id: 'dashboard',
          label: t.dashboard,
          icon: LayoutDashboard,
          group: lang === 'fr' ? 'Pilotage' : 'Overview',
          roles: ['super_admin', 'school_admin', 'accountant', 'teacher'],
        },
        {
          id: 'portal',
          label: t.portal,
          icon: Home,
          group: lang === 'fr' ? 'Pilotage' : 'Overview',
          roles: ['super_admin', 'school_admin', 'parent', 'student'],
        },
        {
          id: 'students',
          label: t.students,
          icon: Users,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin', 'teacher'],
        },
        {
          id: 'teachers',
          label: t.teachers,
          icon: UserCheck,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin'],
        },
        {
          id: 'idcards',
          label: t.idCards,
          icon: CreditCard,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin', 'teacher'],
        },
        {
          id: 'academics',
          label: t.academics,
          icon: BookOpen,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin'],
        },
        {
          id: 'attendance',
          label: t.attendance,
          icon: ClipboardCheck,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin', 'teacher'],
        },
        {
          id: 'exams',
          label: t.exams,
          icon: GraduationCap,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin', 'teacher'],
        },
        {
          id: 'timetable',
          label: t.timetable,
          icon: CalendarDays,
          group: lang === 'fr' ? 'Académique' : 'Academics',
          roles: ['super_admin', 'school_admin', 'teacher'],
        },
        {
          id: 'finance',
          label: t.finance,
          icon: Wallet,
          group: lang === 'fr' ? 'Finances & RH' : 'Finance & HR',
          roles: ['super_admin', 'school_admin', 'accountant'],
        },
        {
          id: 'payroll',
          label: t.payroll,
          icon: Briefcase,
          group: lang === 'fr' ? 'Finances & RH' : 'Finance & HR',
          roles: ['super_admin', 'school_admin', 'accountant'],
        },
        {
          id: 'reports',
          label: t.reports,
          icon: FileSpreadsheet,
          group: lang === 'fr' ? 'Finances & RH' : 'Finance & HR',
          roles: ['super_admin', 'school_admin', 'accountant'],
        },
        {
          id: 'communication',
          label: t.communication,
          icon: MessageSquare,
          group: lang === 'fr' ? 'Administration' : 'Administration',
          roles: ['super_admin', 'school_admin', 'accountant', 'teacher', 'parent', 'student'],
        },
        {
          id: 'users',
          label: t.usersRoles,
          icon: UserCog,
          group: lang === 'fr' ? 'Administration' : 'Administration',
          roles: ['super_admin', 'school_admin'],
        },
        {
          id: 'subscription',
          label: t.subscription,
          icon: CreditCard,
          group: lang === 'fr' ? 'Administration' : 'Administration',
          roles: ['super_admin', 'school_admin'],
        },
        {
          id: 'settings',
          label: t.settings,
          icon: Settings,
          group: lang === 'fr' ? 'Administration' : 'Administration',
          roles: ['super_admin', 'school_admin'],
        },
        {
          id: 'superadmin',
          label: t.superAdmin,
          icon: ShieldAlert,
          group: lang === 'fr' ? 'Administration' : 'Administration',
          roles: ['super_admin'],
        },
      ].filter((item) => user && item.roles.includes(user.role)),
    [t, lang, user]
  );

  const groupedNav = useMemo(() => {
    const groups: { name: string; items: typeof navItems }[] = [];
    for (const item of navItems) {
      let existing = groups.find((g) => g.name === item.group);
      if (!existing) {
        existing = { name: item.group, items: [] };
        groups.push(existing);
      }
      existing.items.push(item);
    }
    return groups;
  }, [navItems]);

  const currentNav = navItems.find((n) => n.id === activeTab) || navItems[0];

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced student quick-search for staff with student module access
  const canSearchStudents = navItems.some((n) => n.id === 'students');
  useEffect(() => {
    const q = searchQuery.trim();
    if (!canSearchStudents || q.length < 2) {
      setStudentHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiRequest<{ items: QuickStudentResult[] }>(
          `/api/students?search=${encodeURIComponent(q)}`
        );
        setStudentHits((res.items || []).slice(0, 5));
      } catch {
        setStudentHits([]);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery, canSearchStudents]);

  const loadNotifications = async () => {
    setNotifsLoading(true);
    try {
      const items: NotificationEntry[] = [];

      // Subscription / 30-day Free Trial alert inside Notifications bell
      if (school && (user?.role === 'school_admin' || user?.role === 'super_admin')) {
        if (subscriptionState.isSubscriptionExpired) {
          items.push({
            id: 'sub-expired',
            title:
              lang === 'fr'
                ? 'Essai gratuit / Abonnement expiré'
                : 'Free Trial / Subscription Expired',
            subtitle:
              lang === 'fr'
                ? 'Activez un forfait pour reprendre l’enregistrement de vos données.'
                : 'Activate a paid plan to resume full write access.',
            targetTab: 'subscription',
            date: subscriptionState.renewsAt || '',
          });
        } else if (subscriptionState.isTrialActive) {
          items.push({
            id: 'sub-trial',
            title:
              lang === 'fr'
                ? `Essai gratuit : ${subscriptionState.trialDaysRemaining} jours restants`
                : `Free Trial: ${subscriptionState.trialDaysRemaining} days left`,
            subtitle:
              lang === 'fr'
                ? `Fin le ${subscriptionState.trialEndsAt.slice(0, 10)}. Choisissez un forfait quand vous êtes prêt.`
                : `Ends on ${subscriptionState.trialEndsAt.slice(0, 10)}. Choose a plan anytime.`,
            targetTab: 'subscription',
            date: subscriptionState.trialEndsAt.slice(0, 10),
          });
        }
      }

      const comm = await apiRequest<{
        items: { id: number; title: string; audience: string; createdAt: string }[];
      }>('/api/communication/announcements').catch(() => ({ items: [] }));

      for (const a of (comm.items || []).slice(0, 4)) {
        items.push({
          id: `ann-${a.id}`,
          title: a.title,
          subtitle: `${lang === 'fr' ? 'Annonce' : 'Announcement'} · ${a.audience}`,
          targetTab: 'communication',
          date: a.createdAt?.slice(0, 10) || '',
        });
      }

      if (!isParentOrStudent) {
        const dash = await apiRequest<{
          recentActivities: { id: number; action: string; details: string; createdAt: string }[];
        }>('/api/schools/dashboard').catch(() => ({ recentActivities: [] }));

        for (const act of (dash.recentActivities || []).slice(0, 4)) {
          items.push({
            id: `act-${act.id}`,
            title: act.action,
            subtitle: act.details,
            targetTab: 'dashboard',
            date: act.createdAt?.slice(0, 10) || '',
          });
        }
      }

      setNotifs(items);
    } finally {
      setNotifsLoading(false);
    }
  };

  const handleToggleNotifs = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setProfileOpen(false);
    if (next) {
      loadNotifications();
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifMsg(null);
    try {
      await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code: verifCode }),
      });
      setVerificationCodePreview(null);
      await refreshSession();
    } catch (err: any) {
      setVerifMsg(err.message);
    }
  };

  const handleResendVerification = async () => {
    const res = await apiRequest<{ verificationCodePreview?: string }>(
      '/api/auth/resend-verification',
      { method: 'POST' }
    );
    if (res.verificationCodePreview) setVerificationCodePreview(res.verificationCodePreview);
  };

  const filteredModules = searchQuery.trim()
    ? navItems.filter((n) => n.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : navItems.slice(0, 5);

  const initials = (user?.fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    school_admin: lang === 'fr' ? 'Direction / Admin' : 'School Admin',
    accountant: lang === 'fr' ? 'Comptable' : 'Accountant',
    teacher: lang === 'fr' ? 'Enseignant' : 'Teacher',
    parent: 'Parent',
    student: lang === 'fr' ? 'Élève' : 'Student',
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar */}
      <aside
        className={`no-print hidden shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 lg:flex ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        <div
          className={`flex items-center border-b border-slate-200 dark:border-slate-800 py-4 ${
            sidebarCollapsed ? 'justify-center px-3' : 'justify-between px-5'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size={sidebarCollapsed ? 'xs' : 'sm'} />
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-display text-sm font-bold tracking-tight text-[#082F5E] dark:text-white leading-tight">
                  EDUSMART
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {school?.name || 'SaaS ERP'}
                </p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title={lang === 'fr' ? 'Réduire le menu' : 'Collapse sidebar'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="flex justify-center border-b border-slate-100 dark:border-slate-800 py-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title={lang === 'fr' ? 'Déplier le menu' : 'Expand sidebar'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groupedNav.map((group) => (
            <div key={group.name}>
              {!sidebarCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.name}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                        sidebarCollapsed ? 'justify-center px-0' : ''
                      } ${
                        active
                          ? 'bg-[#0F2744] dark:bg-[#1E40AF] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#0F2744] dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-3.5 text-xs">
          {!sidebarCollapsed ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2744] dark:bg-blue-600 text-[11px] font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {user?.fullName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {roleLabels[user?.role || ''] || user?.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 font-semibold text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.logout}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              title={t.logout}
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white dark:bg-slate-900 p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <BrandLogo size="xs" />
                  <div className="min-w-0">
                    <span className="font-display text-base font-bold text-[#082F5E] dark:text-white block leading-tight">
                      EDUSMART
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                      {school?.name}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
                {groupedNav.map((group) => (
                  <div key={group.name}>
                    <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {group.name}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer ${
                              activeTab === item.id
                                ? 'bg-[#0F2744] dark:bg-[#1E40AF] text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <button
                type="button"
                onClick={logout}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>{t.logout}</span>
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
              className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 truncate text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="hidden sm:block h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="hidden sm:inline font-semibold text-[#0F2744] dark:text-white truncate max-w-[180px]">
                {school?.name}
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">/</span>
              <span className="font-semibold sm:font-medium text-slate-800 dark:text-slate-200 truncate">
                {currentNav?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {school && (user?.role === 'school_admin' || user?.role === 'super_admin') && (
              <TrialCountdown
                subscriptionState={subscriptionState}
                lang={lang}
                onClick={() => setActiveTab('subscription')}
              />
            )}

            {/* Quick Search */}
            <div ref={searchRef} className="relative hidden md:block w-56 lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder={lang === 'fr' ? 'Aller à un module, élève...' : 'Jump to module, student...'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#1E40AF] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
              />
              <AnimatePresence>
                {searchFocused && (filteredModules.length > 0 || studentHits.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl"
                  >
                    {filteredModules.length > 0 && (
                      <div>
                        <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {lang === 'fr' ? 'Modules' : 'Modules'}
                        </p>
                        {filteredModules.slice(0, 5).map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setActiveTab(item.id);
                                setSearchQuery('');
                                setSearchFocused(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-[#1E40AF] dark:text-blue-400" />
                                <span>{item.label}</span>
                              </span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {studentHits.length > 0 && (
                      <div className="mt-1.5 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                        <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {lang === 'fr' ? 'Élèves correspondants' : 'Matching Students'}
                        </p>
                        {studentHits.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setActiveTab('students');
                              setSearchQuery('');
                              setSearchFocused(false);
                            }}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <span className="truncate font-semibold">
                              {st.firstName} {st.lastName}
                            </span>
                            <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0 ml-2">
                              {st.registrationNumber}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={handleToggleNotifs}
                aria-label={lang === 'fr' ? 'Notifications' : 'Notifications'}
                className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#0F2744] dark:text-white">
                        {lang === 'fr' ? 'Annonces & Activités' : 'Announcements & Activity'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('communication');
                          setNotifOpen(false);
                        }}
                        className="text-[11px] font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {lang === 'fr' ? 'Ouvrir' : 'Open'}
                      </button>
                    </div>
                    {notifsLoading ? (
                      <div className="py-6 text-center text-xs text-slate-400">{t.loading}</div>
                    ) : notifs.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        {lang === 'fr' ? 'Aucune notification récente.' : 'No recent notifications.'}
                      </div>
                    ) : (
                      <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {notifs.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setActiveTab(n.targetTab);
                              setNotifOpen(false);
                            }}
                            className="w-full py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 px-2 rounded-lg transition-colors cursor-pointer"
                          >
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {n.subtitle}
                            </p>
                            {n.date && (
                              <p className="mt-0.5 font-mono-tabular text-[10px] text-slate-400">
                                {n.date}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Switcher */}
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLang('fr')}
                className={`rounded-lg px-2 py-1 font-semibold cursor-pointer ${
                  lang === 'fr'
                    ? 'bg-white dark:bg-slate-700 text-[#0F2744] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-lg px-2 py-1 font-semibold cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white dark:bg-slate-700 text-[#0F2744] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                EN
              </button>
            </div>

            {/* User Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F2744] dark:bg-blue-600 text-[10px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden sm:inline max-w-[110px] truncate font-semibold text-slate-800 dark:text-slate-100">
                  {user?.fullName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xl text-xs"
                  >
                    <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {user?.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user?.email}
                      </p>
                      <p className="mt-1 font-mono-tabular text-[10px] text-slate-400">
                        {roleLabels[user?.role || ''] || user?.role} · {school?.code}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {navItems.some((n) => n.id === 'settings') && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('settings');
                            setProfileOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span>{t.settings}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>{t.logout}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Email Verification Banner if unverified */}
        {user && !user.emailVerified && (
          <div className="no-print border-b border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-4 sm:px-6 py-3 text-xs">
            <form
              onSubmit={handleVerifyEmail}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <MailCheck className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span>
                  {lang === 'fr'
                    ? 'Vérifiez votre adresse email pour sécuriser votre compte.'
                    : 'Verify your email address to secure your account.'}{' '}
                  {verificationCodePreview && (
                    <span className="font-mono-tabular font-bold">
                      (Code : {verificationCodePreview})
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  required
                  value={verifCode}
                  onChange={(e) => setVerifCode(e.target.value)}
                  placeholder="Code à 6 chiffres"
                  className="w-36 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-2.5 py-1 font-mono-tabular text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#0F2744] dark:bg-[#1E40AF] px-3 py-1 font-semibold text-white cursor-pointer"
                >
                  {lang === 'fr' ? 'Valider' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  {lang === 'fr' ? 'Renvoyer' : 'Resend'}
                </button>
                {verifMsg && <span className="text-red-700 dark:text-red-400">{verifMsg}</span>}
              </div>
            </form>
          </div>
        )}

        {/* Trial / Expired Subscription Banner */}
        {school && (user?.role === 'school_admin' || user?.role === 'super_admin') &&
          (subscriptionState.isTrialActive || subscriptionState.isSubscriptionExpired) && (
            <div
              className={`no-print border-b px-4 sm:px-6 py-2.5 text-xs ${
                subscriptionState.isSubscriptionExpired
                  ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                  : subscriptionState.isTrialExpiringSoon
                    ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                    : 'border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 text-[#082F5E] dark:text-blue-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {subscriptionState.isTrialActive ? (
                    <Clock className="h-4 w-4 shrink-0 text-[#E89E0E]" />
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <span>
                    {subscriptionState.isSubscriptionExpired ? (
                      lang === 'fr' ? (
                        <strong>
                          Essai gratuit terminé ou abonnement expiré. Vos données sont en lecture seule jusqu’à activation d’un forfait.
                        </strong>
                      ) : (
                        <strong>
                          Free trial ended or subscription expired. Read-only mode active until a plan is activated.
                        </strong>
                      )
                    ) : lang === 'fr' ? (
                      <>
                        <strong>Essai gratuit 30 jours :</strong> il reste{' '}
                        <span className="font-mono-tabular font-bold">
                          {subscriptionState.trialDaysRemaining} jour(s)
                        </span>{' '}
                        (jusqu’au {subscriptionState.trialEndsAt.slice(0, 10)}). Aucun prélèvement automatique.
                      </>
                    ) : (
                      <>
                        <strong>30-Day Free Trial:</strong>{' '}
                        <span className="font-mono-tabular font-bold">
                          {subscriptionState.trialDaysRemaining} day(s)
                        </span>{' '}
                        remaining (ends {subscriptionState.trialEndsAt.slice(0, 10)}). Zero automatic charge.
                      </>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('subscription')}
                  className="rounded-lg bg-[#082F5E] dark:bg-[#0068C9] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0F2744] transition-colors cursor-pointer"
                >
                  {lang === 'fr' ? 'Choisir un forfait' : 'Choose Plan'}
                </button>
              </div>
            </div>
          )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
            {activeTab === 'students' && <StudentsModule />}
            {activeTab === 'teachers' && <TeachersModule />}
            {activeTab === 'idcards' && <IdCardsModule />}
            {activeTab === 'academics' && <AcademicsModule />}
            {activeTab === 'attendance' && <AttendanceModule />}
            {activeTab === 'finance' && <FinanceModule />}
            {activeTab === 'exams' && <ExamsModule />}
            {activeTab === 'timetable' && <TimetableModule />}
            {activeTab === 'payroll' && <PayrollModule />}
            {activeTab === 'communication' && <CommunicationModule />}
            {activeTab === 'reports' && <ReportsCenter />}
            {activeTab === 'portal' && <PortalView />}
            {activeTab === 'users' && <UsersRolesModule />}
            {activeTab === 'subscription' && <SubscriptionsModule />}
            {activeTab === 'settings' && <SchoolSettingsModule onNavigate={setActiveTab} />}
            {activeTab === 'superadmin' && <SuperAdminModule />}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
