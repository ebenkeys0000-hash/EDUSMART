import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportTableToPdf, exportToExcel } from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
} from '../ui/DesignSystem.tsx';

export const PayrollModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalPaid: 0, totalPending: 0 });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [staffName, setStaffName] = useState('');
  const [roleTitle, setRoleTitle] = useState('Secrétaire / Surveillant');
  const [baseSalary, setBaseSalary] = useState(120000);
  const [allowances, setAllowances] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await apiRequest<any>('/api/payroll');
    setItems(res.items);
    setSummary(res.summary);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const generateMonth = async () => {
    setError(null);
    try {
      await apiRequest('/api/payroll/generate-month', {
        method: 'POST',
        body: JSON.stringify({ month }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/payroll', {
        method: 'POST',
        body: JSON.stringify({
          staffName,
          roleTitle,
          month,
          baseSalary,
          allowances,
          deductions,
        }),
      });
      setStaffName('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markPaid = async (id: number) => {
    await apiRequest(`/api/payroll/${id}/pay`, { method: 'POST' });
    await load();
  };

  const currency = school?.currency || 'XOF';

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Personnel & Paie' : 'Staff & Payroll'}
        subtitle={
          <>
            Payé :{' '}
            <span className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(summary.totalPaid, currency)}
            </span>{' '}
            · En attente :{' '}
            <span className="font-mono-tabular font-semibold text-amber-700 dark:text-amber-400">
              {formatCurrency(summary.totalPending, currency)}
            </span>
          </>
        }
        actions={
          <>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={`${inputBaseClass} w-40 font-mono-tabular`}
            />
            <Button variant="primary" onClick={generateMonth}>
              {lang === 'fr' ? 'Générer paie enseignants' : 'Generate Teacher Payroll'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  items.map((i) => ({
                    Mois: i.month,
                    Employé: i.staffName,
                    Poste: i.roleTitle,
                    Base: i.baseSalary,
                    Primes: i.allowances,
                    Retenues: i.deductions,
                    Net: i.netSalary,
                    Statut: i.status,
                  })),
                  'Paie',
                  `EDUSMART_Paie_${month}`
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
                  'État Mensuel de la Paie du Personnel',
                  `Période : ${month}`,
                  ['Employé', 'Poste', 'Mois', 'Net à payer', 'Statut'],
                  items.map((i) => [
                    i.staffName,
                    i.roleTitle,
                    i.month,
                    formatCurrency(i.netSalary, currency),
                    i.status,
                  ]),
                  `EDUSMART_Paie_${month}`,
                  school?.name
                )
              }
            >
              <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <span>PDF</span>
            </Button>
          </>
        }
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SurfaceCard className="lg:col-span-4 h-fit">
          <form onSubmit={createEntry} className="space-y-3 text-xs">
            <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
              Ajouter une fiche de paie
            </h2>
            <input
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Nom complet de l'employé"
              className={inputBaseClass}
            />
            <input
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Fonction"
              className={inputBaseClass}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Base</label>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                  className={`mt-1 ${inputBaseClass} font-mono-tabular px-2 py-1.5`}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Primes</label>
                <input
                  type="number"
                  value={allowances}
                  onChange={(e) => setAllowances(Number(e.target.value))}
                  className={`mt-1 ${inputBaseClass} font-mono-tabular px-2 py-1.5`}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400">Retenues</label>
                <input
                  type="number"
                  value={deductions}
                  onChange={(e) => setDeductions(Number(e.target.value))}
                  className={`mt-1 ${inputBaseClass} font-mono-tabular px-2 py-1.5`}
                />
              </div>
            </div>
            <Button type="submit" variant="primary" className="w-full">
              <Plus className="h-4 w-4" />
              <span>Enregistrer</span>
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard padding="none" className="overflow-hidden lg:col-span-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employé</th>
                  <th className="px-4 py-3 font-semibold">Mois</th>
                  <th className="px-4 py-3 font-semibold">Salaire Net</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {item.staffName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.roleTitle}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular">{item.month}</td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                      {formatCurrency(item.netSalary, currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold capitalize text-slate-700 dark:text-slate-300">
                      {item.status === 'paid' ? `Payé (${item.paidAt})` : 'En attente'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status !== 'paid' && (
                        <Button
                          variant="emerald"
                          size="sm"
                          onClick={() => markPaid(item.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Marquer payé</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};
