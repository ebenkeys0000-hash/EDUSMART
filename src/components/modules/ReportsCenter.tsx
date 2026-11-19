import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportTableToPdf, exportToExcel } from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import { PageHeader, SurfaceCard, Button } from '../ui/DesignSystem.tsx';

export const ReportsCenter: React.FC = () => {
  const { lang, school } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const currency = school?.currency || 'XOF';

  const runExport = async (key: string, format: 'pdf' | 'excel') => {
    setBusyKey(`${key}-${format}`);
    try {
      if (key === 'students') {
        const res = await apiRequest<{ items: any[] }>('/api/students?pageSize=200&status=all');
        if (format === 'excel') {
          exportToExcel(
            res.items.map((s) => ({
              Matricule: s.registrationNumber,
              Nom: s.lastName,
              Prénom: s.firstName,
              Classe: s.className,
              Parent: s.parentName,
              Téléphone: s.parentPhone,
              Statut: s.status,
            })),
            'Élèves',
            'EDUSMART_Eleves'
          );
        } else {
          exportTableToPdf(
            'Registre Officiel des Élèves',
            `${res.items.length} dossiers`,
            ['Matricule', 'Nom complet', 'Classe', 'Parent', 'Téléphone', 'Statut'],
            res.items.map((s) => [
              s.registrationNumber,
              `${s.firstName} ${s.lastName}`,
              s.className,
              s.parentName || '—',
              s.parentPhone || '—',
              s.status,
            ]),
            'EDUSMART_Eleves',
            school?.name
          );
        }
      } else if (key === 'teachers') {
        const res = await apiRequest<{ items: any[] }>('/api/teachers');
        if (format === 'excel') {
          exportToExcel(res.items, 'Enseignants', 'EDUSMART_Enseignants');
        } else {
          exportTableToPdf(
            'Liste du Personnel Enseignant',
            `${res.items.length} enseignants`,
            ['Code', 'Nom complet', 'Spécialité', 'Téléphone', 'Salaire'],
            res.items.map((t) => [
              t.employeeCode,
              `${t.firstName} ${t.lastName}`,
              t.specialization || '—',
              t.phone || '—',
              formatCurrency(t.baseSalary, currency),
            ]),
            'EDUSMART_Enseignants',
            school?.name
          );
        }
      } else if (key === 'classes') {
        const res = await apiRequest<{ classes: any[] }>('/api/academics/structure');
        if (format === 'excel') {
          exportToExcel(res.classes, 'Classes', 'EDUSMART_Classes');
        } else {
          exportTableToPdf(
            'Liste des Classes & Effectifs',
            `${res.classes.length} classes`,
            ['Classe', 'Niveau', 'Salle', 'Effectif', 'Capacité', 'Titulaire'],
            res.classes.map((c) => [
              c.name,
              c.level,
              c.room || '—',
              c.studentCount,
              c.capacity,
              c.homeroomTeacherName,
            ]),
            'EDUSMART_Classes',
            school?.name
          );
        }
      } else if (key === 'finance') {
        const res = await apiRequest<any>('/api/finance/overview');
        if (format === 'excel') {
          exportToExcel(res.payments, 'Paiements', 'EDUSMART_Paiements');
        } else {
          exportTableToPdf(
            'État Financier & Encaissements',
            `Total encaissé : ${formatCurrency(res.summary.totalCollected, currency)}`,
            ['Reçu', 'Élève', 'Date', 'Mode', 'Montant'],
            res.payments.map((p: any) => [
              p.receiptNumber,
              p.studentName,
              p.paidAt,
              p.paymentMethod,
              formatCurrency(p.amount, currency),
            ]),
            'EDUSMART_Etat_Financier',
            school?.name
          );
        }
      } else if (key === 'attendance') {
        const month = new Date().toISOString().slice(0, 7);
        const res = await apiRequest<any>(`/api/attendance/reports?month=${month}`);
        if (format === 'excel') {
          exportToExcel(res.studentStats, 'Présences', `EDUSMART_Presences_${month}`);
        } else {
          exportTableToPdf(
            `Rapport Mensuel des Présences (${month})`,
            `Synthèse par classe`,
            ['Classe', 'Présents', 'Absents', 'Retards', 'Taux %'],
            res.classStats.map((c: any) => [c.className, c.present, c.absent, c.late, `${c.rate}%`]),
            `EDUSMART_Presences_${month}`,
            school?.name
          );
        }
      }
    } finally {
      setBusyKey(null);
    }
  };

  const reports = [
    {
      key: 'students',
      title: lang === 'fr' ? 'Liste officielle des élèves' : 'Student Roster',
      desc: 'Matricules, classes, coordonnées des parents et statuts.',
    },
    {
      key: 'teachers',
      title: lang === 'fr' ? 'Répertoire des enseignants' : 'Teacher Directory',
      desc: 'Codes employés, qualifications, spécialités et salaires.',
    },
    {
      key: 'classes',
      title: lang === 'fr' ? 'Structure des classes' : 'Class Lists & Capacities',
      desc: 'Effectifs par classe, salles et professeurs principaux.',
    },
    {
      key: 'finance',
      title: lang === 'fr' ? 'États financiers & Paiements' : 'Financial & Payment Statements',
      desc: 'Encaissements détaillés, quittances et modes de règlement.',
    },
    {
      key: 'attendance',
      title: lang === 'fr' ? 'Statistiques mensuelles d’assiduité' : 'Monthly Attendance Reports',
      desc: 'Taux de présence, retards et absences par classe et élève.',
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Documents & Exports Officiels' : 'Documents & Reports'}
        subtitle="Génération directe en PDF et Excel (.xlsx) à partir des données PostgreSQL de votre école"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((rep) => (
          <SurfaceCard key={rep.key} className="flex flex-col justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
                {rep.title}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {rep.desc}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
              <Button
                variant="primary"
                className="flex-1"
                disabled={busyKey !== null}
                onClick={() => runExport(rep.key, 'pdf')}
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF</span>
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busyKey !== null}
                onClick={() => runExport(rep.key, 'excel')}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Excel</span>
              </Button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
};
