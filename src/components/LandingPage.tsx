import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  ShieldCheck,
  Wallet,
  CalendarClock,
  FileSpreadsheet,
  Users,
  QrCode,
  Sun,
  Moon,
  Menu,
  X,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { formatCurrency, translations } from '../lib/i18n.ts';
import { inputBaseClass } from './ui/DesignSystem.tsx';
import { BrandLogo } from './ui/BrandLogo.tsx';
import {
  BillingCycle,
  DEFAULT_SUBSCRIPTION_PLANS,
  SubscriptionPlanConfig,
  SubscriptionPlanKey,
} from '../lib/subscriptionCatalog.ts';

interface LandingPageProps {
  onOpenAuth: (
    mode: 'login' | 'register',
    opts?: { planKey?: SubscriptionPlanKey; billingCycle?: BillingCycle }
  ) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { lang, setLang } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = translations[lang];
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(DEFAULT_SUBSCRIPTION_PLANS);

  useEffect(() => {
    fetch('/api/subscriptions/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch(() => {});
  }, []);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactSchool, setContactSchool] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSent, setContactSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactError(
        lang === 'fr' ? 'Veuillez saisir une adresse email valide.' : 'Please enter a valid email.'
      );
      return;
    }
    setContactSent(true);
    setContactName('');
    setContactSchool('');
    setContactEmail('');
    setContactPhone('');
    setContactMsg('');
  };

  const features =
    lang === 'fr'
      ? [
          {
            num: '01.',
            title: 'Architecture Multi-Écoles Isolée',
            desc: "Chaque établissement dispose de son propre espace cloisonné dans PostgreSQL : élèves, classes, notes, finances et rapports sont strictement isolés par identifiant d'école et contrôlés par rôle.",
            span: 'lg:col-span-2',
            icon: ShieldCheck,
          },
          {
            num: '02.',
            title: 'Scolarité FCFA (XOF / XAF) & Reçus',
            desc: 'Facturation par classe ou par élève, paiements partiels, soldes restants, quittances PDF imprimables et connecteurs prêts pour FedaPay & Kkiapay.',
            span: 'lg:col-span-1',
            icon: Wallet,
          },
          {
            num: '03.',
            title: 'Examens, Moyennes & Bulletins PDF',
            desc: 'Saisie des notes par matière et coefficient, calcul automatique des moyennes générales, classement de la classe et édition des bulletins scolaires PDF.',
            span: 'lg:col-span-1',
            icon: GraduationCap,
          },
          {
            num: '04.',
            title: 'Cartes Scolaires QR & Appel Quotidien',
            desc: "Génération automatique de cartes d'identité scolaires Recto/Verso avec photo, classe et QR code, scannables par caméra ou lecteur USB pour valider la présence.",
            span: 'lg:col-span-2',
            icon: QrCode,
          },
          {
            num: '05.',
            title: 'Emplois du Temps, Portail & Paie',
            desc: 'Détection automatique des conflits de salle/enseignant, portail dédié aux parents et élèves, et calcul mensuel de la paie du personnel.',
            span: 'lg:col-span-2',
            icon: CalendarClock,
          },
          {
            num: '06.',
            title: 'Exports PDF & Excel Instantanés',
            desc: 'Téléchargez en un clic les listes d’élèves, états financiers, registres de présence, cartes scolaires et bulletins aux formats PDF et Excel (.xlsx).',
            span: 'lg:col-span-1',
            icon: FileSpreadsheet,
          },
        ]
      : [
          {
            num: '01.',
            title: 'Strict Multi-Tenant School Isolation',
            desc: 'Every school runs in an isolated PostgreSQL tenant boundary. Students, teachers, grades, and financial ledgers are strictly scoped to your authorized institution.',
            span: 'lg:col-span-2',
            icon: ShieldCheck,
          },
          {
            num: '02.',
            title: 'XOF / XAF School Fees & Receipts',
            desc: 'Class-wide or individual invoicing, partial installments, live unpaid balances, printable PDF receipts, and ready-to-wire FedaPay & Kkiapay hooks.',
            span: 'lg:col-span-1',
            icon: Wallet,
          },
          {
            num: '03.',
            title: 'Examinations, Rankings & Report Cards',
            desc: 'Subject-level grade entry with coefficients, automated weighted averages, class rank computation, and instant PDF report card generation.',
            span: 'lg:col-span-1',
            icon: GraduationCap,
          },
          {
            num: '04.',
            title: 'QR School ID Cards & Daily Attendance',
            desc: 'Auto-generated Front/Back Student ID cards with photo, class, and scannable back QR code verified live via camera or USB scanner at school entry.',
            span: 'lg:col-span-2',
            icon: QrCode,
          },
          {
            num: '05.',
            title: 'Timetables, Parent Portal & Staff Payroll',
            desc: 'Schedule conflict detection, role-scoped portals for families and students, and automated monthly teacher payroll generation.',
            span: 'lg:col-span-2',
            icon: Users,
          },
          {
            num: '06.',
            title: 'One-Click PDF & Excel Reporting',
            desc: 'Export enrollment rosters, attendance sheets, ID cards, exam rankings, and financial statements cleanly to PDF and Excel spreadsheets.',
            span: 'lg:col-span-1',
            icon: FileSpreadsheet,
          },
        ];

  const faqs =
    lang === 'fr'
      ? [
          {
            q: 'Comment les données de notre école sont-elles isolées des autres établissements ?',
            a: 'Chaque établissement créé sur EDUSMART reçoit un identifiant locataire unique. Toutes les tables PostgreSQL (élèves, notes, factures, présences, emplois du temps) sont filtrées côté serveur selon votre session authentifiée et votre rôle.',
          },
          {
            q: 'Comment fonctionnent les cartes scolaires avec QR code ?',
            a: 'Lors de l’inscription d’un élève, EDUSMART génère automatiquement une carte Recto/Verso affichant sa photo, sa classe et son matricule au recto, ainsi qu’un QR code scannable au verso pour valider instantanément son arrivée à l’école.',
          },
          {
            q: 'EDUSMART gère-t-il le franc CFA (XOF / XAF) et les paiements partiels ?',
            a: 'Oui. Vous pouvez définir vos frais de scolarité, inscription et examen en XOF ou XAF, enregistrer des règlements par tranches, suivre automatiquement les impayés et imprimer les quittances PDF. Les références FedaPay et Kkiapay sont intégrées.',
          },
          {
            q: 'Pouvons-nous donner un accès restreint aux enseignants, comptables et parents ?',
            a: "Oui. Le contrôle d'accès par rôle (RBAC) attribue des permissions précises à chaque profil : Administrateur École, Comptable, Enseignant, Parent et Élève.",
          },
        ]
      : [
          {
            q: 'How is our school data isolated from other institutions?',
            a: 'Every school registered on EDUSMART gets an isolated tenant boundary in PostgreSQL. Every API query enforces strict school-level and role-based verification.',
          },
          {
            q: 'How do Student QR ID Cards and attendance scanning work?',
            a: 'When registering a student, EDUSMART generates a printable Front/Back ID Card with photo and class on the front and a unique QR code on the back, verified via live camera or USB scanner.',
          },
          {
            q: 'Does EDUSMART support XOF / XAF currencies and partial tuition payments?',
            a: 'Yes. You can bill tuition, registration, and exam fees in XOF, XAF, EUR, or USD, record partial installments, track unpaid balances, and export printable PDF receipts with FedaPay and Kkiapay reference tracking.',
          },
          {
            q: 'Can accountants, teachers, parents, and students have separate permissions?',
            a: 'Yes. Built-in role-based access control restricts each user to their authorized modules—School Admin, Accountant, Teacher, Parent, and Student.',
          },
        ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="flex items-center gap-3 text-lg font-bold tracking-tight text-[#082F5E] dark:text-white whitespace-nowrap shrink-0 font-display"
          >
            <BrandLogo size="sm" />
            <span className="hidden sm:inline">EDUSMART</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#features"
              className="hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navFeatures}
            </a>
            <a
              href="#benefits"
              className="hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navBenefits}
            </a>
            <a
              href="#pricing"
              className="hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navPricing}
            </a>
            <a
              href="#faq"
              className="hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navFaq}
            </a>
            <a
              href="#contact"
              className="hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hidden sm:inline-flex text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#0F2744] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.login}
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="rounded-xl bg-[#0F2744] dark:bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16365D] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.getStarted}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menu"
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-slate-600 dark:text-slate-300 md:hidden cursor-pointer"
            >
              {mobileNavOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              <a href="#features" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                {t.navFeatures}
              </a>
              <a href="#benefits" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                {t.navBenefits}
              </a>
              <a href="#pricing" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                {t.navPricing}
              </a>
              <a href="#faq" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                {t.navFaq}
              </a>
              <a href="#contact" onClick={() => setMobileNavOpen(false)} className="py-1.5">
                Contact
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onOpenAuth('login');
                }}
                className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-center font-semibold cursor-pointer"
              >
                {t.login}
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:py-20">
            {/* Sub-header toolbar for language and theme preferences */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.heroKicker}
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-3.5 w-3.5 text-amber-400" />
                      <span>{lang === 'fr' ? 'Clair' : 'Light'}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-3.5 w-3.5 text-[#0F2744]" />
                      <span>{lang === 'fr' ? 'Sombre' : 'Dark'}</span>
                    </>
                  )}
                </button>

                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => setLang('fr')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      lang === 'fr'
                        ? 'bg-white dark:bg-slate-800 text-[#0F2744] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      lang === 'en'
                        ? 'bg-white dark:bg-slate-800 text-[#0F2744] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col justify-center lg:col-span-6"
              >
                <h1
                  className="font-display font-bold tracking-tight text-[#0F2744] dark:text-white"
                  style={{
                    fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)',
                    lineHeight: 1.08,
                    textWrap: 'balance',
                  }}
                >
                  {t.heroTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                  {t.heroSubtitle}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register', { planKey: 'multi_niveaux', billingCycle })}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#082F5E] dark:bg-[#0068C9] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF] transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>
                      {lang === 'fr' ? 'Essai gratuit 30 jours' : 'Start 30-Day Free Trial'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('login')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-[#082F5E] dark:hover:border-slate-500 hover:text-[#082F5E] dark:hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {t.heroSecondaryCta}
                  </button>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#082F5E] dark:text-amber-300">
                  <Sparkles className="h-3.5 w-3.5 text-[#E89E0E] shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Essai gratuit 30 jours sans carte bancaire · Paiement requis uniquement après confirmation'
                      : '30-day free trial with no card required · Zero auto-billing'}
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>PostgreSQL Multi-Tenant</span>
                  <span aria-hidden="true">·</span>
                  <span>XOF & XAF Ready</span>
                  <span aria-hidden="true">·</span>
                  <span>{lang === 'fr' ? 'Cartes Scolaires QR' : 'QR ID Cards'}</span>
                  <span aria-hidden="true">·</span>
                  <span>FedaPay & Kkiapay Architecture</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-6"
              >
                <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-sm">
                  <img
                    src="/src/assets/images/hero_campus_africa_1795083240219.jpg"
                    alt={
                      lang === 'fr'
                        ? 'Campus scolaire moderne en Afrique de l’Ouest'
                        : 'Modern private school campus in West Africa'
                    }
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-6 text-white">
                    <p className="text-xs font-medium text-slate-200">
                      Cotonou · Lomé · Abidjan · Dakar · Douala
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {lang === 'fr'
                        ? 'Conçu pour les collèges, lycées et groupes scolaires privés'
                        : 'Built for private primary, secondary, and multi-campus schools'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* 4-Column Operational KPI Strip */}
            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-slate-200 dark:border-slate-800 pt-8 lg:grid-cols-4">
              <div>
                <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">6</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Rôles RBAC isolés par établissement'
                    : 'Isolated school access roles'}
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">100%</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Traçabilité des encaissements FCFA'
                    : 'XOF / XAF payment auditability'}
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">QR & PDF</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Cartes scolaires, bulletins & reçus'
                    : 'ID cards, report cards & receipts'}
                </p>
              </div>
              <div>
                <p className="font-mono-tabular text-2xl font-bold text-[#0F2744] dark:text-white">FR / EN</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'fr'
                    ? 'Interface bilingue & mode sombre'
                    : 'Native bilingual & dark mode'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Bento Grid */}
        <section id="features" className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF] dark:text-blue-400">
              {lang === 'fr' ? 'Architecture Modulaire' : 'Modular Architecture'}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F2744] dark:text-white">
              {lang === 'fr'
                ? 'Chaque opération scolaire reliée à une base de données unique'
                : 'Every academic and financial operation connected to one database'}
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.num}
                  className={`${feat.span} rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tabular text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                      {feat.num}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-[#0F2744] dark:text-blue-300">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-[#0F2744] dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Benefits for School Administrators */}
        <section
          id="benefits"
          className="border-y border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        >
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
            <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="h-full min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  <img
                    src="/src/assets/images/classroom_learning_africa_1795083238588.jpg"
                    alt={
                      lang === 'fr'
                        ? 'Salle de classe et suivi pédagogique numérique'
                        : 'Classroom digital learning and academic monitoring'
                    }
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-center lg:col-span-6">
                <p className="text-xs font-semibold tracking-wide text-[#1E40AF] dark:text-blue-400">
                  {lang === 'fr' ? 'Bénéfices Direction & Économat' : 'For Principals & Bursars'}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#0F2744] dark:text-white">
                  {lang === 'fr'
                    ? 'Zéro perte de dossiers, recouvrement maîtrisé et conseils de classe préparés en minutes.'
                    : 'Eliminate paper bottlenecks, tighten fee collection, and prepare term rankings in minutes.'}
                </h2>

                <div className="mt-8 space-y-6 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="pt-2">
                    <h3 className="text-sm font-bold text-[#0F2744] dark:text-white">
                      {lang === 'fr'
                        ? 'Suivi en temps réel des impayés par classe'
                        : 'Live Unpaid Tuition Tracking by Class'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {lang === 'fr'
                        ? 'Identifiez immédiatement les soldes restants par élève, émettez des reçus numérotés et préparez l’encaissement Mobile Money.'
                        : 'Spot overdue balances per student, issue numbered receipts, and reconcile cash, bank, FedaPay, or Kkiapay payments.'}
                    </p>
                  </div>
                  <div className="pt-5">
                    <h3 className="text-sm font-bold text-[#0F2744] dark:text-white">
                      {lang === 'fr'
                        ? 'Contrôle d’accès par Carte Scolaire QR & Bulletins Automatisés'
                        : 'QR ID Card Attendance & Automated Class Rankings'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {lang === 'fr'
                        ? 'Pointez les arrivées en scannant le verso de la carte scolaire et éditez vos bulletins pondérés avec rangs et mentions en un clic.'
                        : 'Verify student arrivals via ID card QR scanning and generate weighted report cards with class ranks in one click.'}
                    </p>
                  </div>
                  <div className="pt-5">
                    <h3 className="text-sm font-bold text-[#0F2744] dark:text-white">
                      {lang === 'fr'
                        ? 'Transparence directe avec les parents d’élèves'
                        : 'Direct Parent & Student Visibility'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {lang === 'fr'
                        ? 'Les parents consultent les notes, absences, cartes scolaires et factures sans encombrer le secrétariat.'
                        : 'Parents check attendance, exam marks, ID cards, and tuition balances directly from their dedicated portal.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-[1280px] px-6 py-16">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {lang === 'fr'
                  ? '« Avant EDUSMART, nos bulletins trimestriels prenaient trois semaines de saisie manuelle sur tableur. Aujourd’hui, les moyennes et classements de nos 18 classes sont prêts en moins d’une heure, sans erreur de coefficient. »'
                  : '“Before EDUSMART, preparing term report cards across 18 classes took three weeks on spreadsheets. Now weighted averages and rankings are computed in under an hour with zero calculation errors.”'}
              </p>
              <div className="mt-6 flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                <img
                  src="/src/assets/images/avatar_school_director_1795083241584.jpg"
                  alt="Directeur Apollinaire Gbénou"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
                <div>
                  <p className="text-sm font-bold text-[#0F2744] dark:text-white">
                    Apollinaire Gbénou
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Directeur des Études · Collège Privé Les Palmiers, Cotonou
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7">
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {lang === 'fr'
                  ? '« Le passage aux quittances numérotées et au suivi des tranches en FCFA a augmenté notre taux de recouvrement de 22 % dès le premier trimestre. Chaque paiement est justifié et exportable pour le commissaire aux comptes. »'
                  : '“Switching to numbered PDF receipts and installment tracking in XOF raised our first-term tuition collection rate by 22%. Every payment is auditable and export-ready.”'}
              </p>
              <div className="mt-6 flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                <img
                  src="/src/assets/images/avatar_school_bursar_1795083238932.jpg"
                  alt="Économe Mireille Soglo"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
                <div>
                  <p className="text-sm font-bold text-[#0F2744] dark:text-white">Mireille Soglo</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Responsable Financière · Groupe Scolaire Horizon, Lomé
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Plans */}
        <section
          id="pricing"
          className="border-y border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        >
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-wide text-[#0068C9] dark:text-blue-400">
                  {lang === 'fr' ? 'Tarification Transparente en FCFA' : 'Transparent FCFA SaaS Pricing'}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#082F5E] dark:text-white">
                  {lang === 'fr'
                    ? 'Des forfaits adaptés à chaque cycle scolaire'
                    : 'Plans calibrated for every academic cycle'}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {lang === 'fr'
                    ? 'Chaque nouvel établissement bénéficie automatiquement de 30 jours d’essai gratuit complet, sans carte bancaire ni prélèvement automatique.'
                    : 'Every new school automatically starts with a full 30-day free trial with zero upfront payment or hidden auto-billing.'}
                </p>
              </div>

              {/* Monthly vs Annual (-20%) Toggle */}
              <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`rounded-lg px-4 py-2 transition-colors cursor-pointer whitespace-nowrap ${
                    billingCycle === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-[#082F5E] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'fr' ? 'Facturation Mensuelle' : 'Monthly Billing'}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`rounded-lg px-4 py-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-[#082F5E] dark:bg-[#0068C9] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{lang === 'fr' ? 'Facturation Annuelle' : 'Annual Billing'}</span>
                  <span className="rounded bg-[#E89E0E] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    -20%
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const featured = plan.isPopular;
                const activePrice =
                  billingCycle === 'annual' ? plan.annualPriceXof : plan.monthlyPriceXof;
                const featuresList = lang === 'fr' ? plan.featuresFr : plan.featuresEn;

                return (
                  <div
                    key={plan.planKey}
                    className={`flex flex-col justify-between rounded-2xl border p-6 transition-all ${
                      featured
                        ? 'border-[#082F5E] bg-[#082F5E] dark:border-blue-600 dark:bg-gradient-to-b dark:from-[#082F5E] dark:to-[#0F2744] text-white shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-lg font-bold leading-snug">
                          {lang === 'fr' ? plan.nameFr : plan.nameEn}
                        </h3>
                        {featured && (
                          <span className="rounded-md bg-[#E89E0E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                            {lang === 'fr' ? 'Complet' : 'Full Suite'}
                          </span>
                        )}
                      </div>
                      <p
                        className={`mt-1.5 text-xs leading-relaxed ${
                          featured ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {lang === 'fr' ? plan.subtitleFr : plan.subtitleEn}
                      </p>

                      <div className="mt-5">
                        {billingCycle === 'annual' && (
                          <p
                            className={`font-mono-tabular text-xs line-through ${
                              featured ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {formatCurrency(plan.regularAnnualXof, 'XOF')} / {lang === 'fr' ? 'an' : 'yr'}
                          </p>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono-tabular text-2xl font-bold">
                            {formatCurrency(activePrice, 'XOF')}
                          </span>
                          <span
                            className={`text-xs ${
                              featured ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {billingCycle === 'annual'
                              ? lang === 'fr'
                                ? '/ an'
                                : '/ year'
                              : lang === 'fr'
                                ? '/ mois'
                                : '/ month'}
                          </span>
                        </div>
                        {billingCycle === 'annual' ? (
                          <p
                            className={`mt-1 font-mono-tabular text-[11px] font-semibold ${
                              featured ? 'text-amber-300' : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {lang === 'fr'
                              ? `Économisez ${formatCurrency(plan.savingsXof, 'XOF')} (-${plan.annualDiscountPercent}%)`
                              : `Save ${formatCurrency(plan.savingsXof, 'XOF')} (-${plan.annualDiscountPercent}%)`}
                          </p>
                        ) : (
                          <p
                            className={`mt-1 text-[11px] ${
                              featured ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {lang === 'fr'
                              ? `Ou ${formatCurrency(plan.annualPriceXof, 'XOF')} / an (-${plan.annualDiscountPercent}%)`
                              : `Or ${formatCurrency(plan.annualPriceXof, 'XOF')} / yr (-${plan.annualDiscountPercent}%)`}
                          </p>
                        )}
                      </div>

                      <ul className="mt-5 space-y-2.5 border-t border-current/10 pt-5 text-xs sm:text-sm">
                        {featuresList.map((lim) => (
                          <li key={lim} className="flex items-start gap-2 leading-snug">
                            <CheckCircle2
                              className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                                featured ? 'text-[#E89E0E]' : 'text-[#0068C9] dark:text-blue-400'
                              }`}
                            />
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-7 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuth('register', { planKey: plan.planKey, billingCycle })
                        }
                        className={`w-full rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          featured
                            ? 'bg-[#E89E0E] text-white hover:bg-[#D97706]'
                            : 'bg-[#082F5E] dark:bg-[#0068C9] text-white hover:bg-[#0F2744] dark:hover:bg-[#1E40AF]'
                        }`}
                      >
                        {lang === 'fr' ? 'Choisir ce forfait' : 'Select Plan'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuth('register', { planKey: plan.planKey, billingCycle })
                        }
                        className={`w-full rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                          featured
                            ? 'border-white/25 text-white hover:bg-white/10'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {lang === 'fr' ? 'Commencer gratuitement (30 j)' : 'Start Free Trial (30d)'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="mx-auto max-w-[920px] px-6 py-16 lg:py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#0F2744] dark:text-white sm:text-3xl">
            {lang === 'fr' ? 'Questions fréquentes' : 'Frequently Asked Questions'}
          </h2>
          <div className="mt-8 divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="p-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
                  >
                    <span className="font-display text-base font-semibold text-[#0F2744] dark:text-white">
                      {item.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact Section */}
        <section
          id="contact"
          className="border-t border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/60"
        >
          <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-5">
                <p className="text-xs font-semibold tracking-wide text-[#1E40AF] dark:text-blue-400">
                  {lang === 'fr' ? 'Accompagnement & Déploiement' : 'Deployment & Support'}
                </p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-[#0F2744] dark:text-white">
                  {lang === 'fr'
                    ? 'Planifiez une démonstration pour votre établissement'
                    : 'Schedule an onboarding briefing for your school'}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {lang === 'fr'
                    ? 'Notre équipe accompagne les fondateurs, proviseurs et économes à Cotonou, Lomé, Abidjan, Dakar et à l’international pour migrer vos effectifs et configurer votre établissement en moins de 48h.'
                    : 'Our onboarding specialists help school directors and bursars across West Africa and internationally import rosters and launch within 48 hours.'}
                </p>

                <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-5 text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-[#1E40AF] dark:text-blue-400 shrink-0" />
                    <span>ebenkeys0000@gmail.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-[#1E40AF] dark:text-blue-400 shrink-0" />
                    <span className="font-mono-tabular">
                      +2290195441602 ({lang === 'fr' ? 'Téléphone & WhatsApp' : 'Phone & WhatsApp'})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-[#1E40AF] dark:text-blue-400 shrink-0" />
                    <span>Cotonou (Bénin) · Lomé (Togo) · International Cloud</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <form
                  onSubmit={handleContactSubmit}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900 p-6 sm:p-8 space-y-4"
                >
                  {contactSent && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        {lang === 'fr'
                          ? 'Votre demande a bien été enregistrée. Un conseiller EDUSMART vous contactera sous 24h ouvrées.'
                          : 'Your request has been received. An EDUSMART advisor will contact you within 24 hours.'}
                      </span>
                    </div>
                  )}
                  {contactError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                      {contactError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'fr' ? 'Nom complet *' : 'Full Name *'}
                      </label>
                      <input
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Apollinaire Gbénou"
                        className={inputBaseClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'fr' ? 'Nom de l’établissement *' : 'School Name *'}
                      </label>
                      <input
                        required
                        value={contactSchool}
                        onChange={(e) => setContactSchool(e.target.value)}
                        placeholder="Collège Privé Les Palmiers"
                        className={inputBaseClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="direction@ecole.bj"
                        className={inputBaseClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'fr' ? 'Téléphone / WhatsApp' : 'Phone / WhatsApp'}
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+229 97 00 00 00"
                        className={inputBaseClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'fr' ? 'Vos besoins prioritaires *' : 'Project Details *'}
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={contactMsg}
                      onChange={(e) => setContactMsg(e.target.value)}
                      placeholder={
                        lang === 'fr'
                          ? 'Nombre d’élèves, gestion des frais FCFA, cartes scolaires QR, bulletins...'
                          : 'Student count, tuition billing, QR ID cards, report cards...'
                      }
                      className={inputBaseClass}
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F2744] dark:bg-[#1E40AF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#16365D] dark:hover:bg-[#2563EB] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Send className="h-4 w-4" />
                    <span>{lang === 'fr' ? 'Envoyer la demande' : 'Submit Inquiry'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Professional Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <BrandLogo size="sm" />
            <div>
              <p className="font-display text-base font-bold text-[#082F5E] dark:text-white">
                EDUSMART
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'fr'
                  ? 'Apprendre • Progresser • Réussir · Gestion scolaire SaaS en Afrique & à l’international'
                  : 'Apprendre • Progresser • Réussir · Cloud School Management SaaS'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-[#0F2744] dark:hover:text-white">
              {t.navFeatures}
            </a>
            <a href="#pricing" className="hover:text-[#0F2744] dark:hover:text-white">
              {t.navPricing}
            </a>
            <a href="#contact" className="hover:text-[#0F2744] dark:hover:text-white">
              Contact
            </a>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-[#0F2744] dark:hover:text-white cursor-pointer"
            >
              {t.login}
            </button>
            <button
              type="button"
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="hover:text-[#0F2744] dark:hover:text-white cursor-pointer"
            >
              {lang === 'fr' ? 'English' : 'Français'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
