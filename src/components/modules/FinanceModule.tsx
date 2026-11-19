import React, { useEffect, useState } from 'react';
import { Plus, Receipt, Download, FileSpreadsheet, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { exportReceiptPdf, exportTableToPdf, exportToExcel } from '../../lib/exports.ts';
import { formatCurrency } from '../../lib/i18n.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
  SegmentedTabs,
  ModalDialog,
  AnimatedNumber,
  TableSkeleton,
} from '../ui/DesignSystem.tsx';

export const FinanceModule: React.FC = () => {
  const { lang, school } = useAuth();
  const [data, setData] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'invoices' | 'payments' | 'categories'>('invoices');

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invTargetType, setInvTargetType] = useState<'student' | 'class'>('student');
  const [invStudentId, setInvStudentId] = useState('');
  const [invClassId, setInvClassId] = useState('');
  const [invCategoryId, setInvCategoryId] = useState('');
  const [invTitle, setInvTitle] = useState('Frais de scolarité 2026-2027');
  const [invAmount, setInvAmount] = useState(185000);
  const [invDueDate, setInvDueDate] = useState('2026-12-15');

  const [payingInvoice, setPayingInvoice] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState('tuition');
  const [catAmount, setCatAmount] = useState(25000);

  const load = async () => {
    setLoading(true);
    try {
      const [fin, st, acad] = await Promise.all([
        apiRequest('/api/finance/overview'),
        apiRequest<{ items: any[] }>('/api/students?pageSize=100'),
        apiRequest<{ classes: any[] }>('/api/academics/structure'),
      ]);
      setData(fin);
      setStudents(st.items);
      setClasses(acad.classes);
      if (st.items[0] && !invStudentId) setInvStudentId(String(st.items[0].id));
      if (acad.classes[0] && !invClassId) setInvClassId(String(acad.classes[0].id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          studentId: invTargetType === 'student' ? Number(invStudentId) : null,
          classId: invTargetType === 'class' ? Number(invClassId) : null,
          feeCategoryId: invCategoryId ? Number(invCategoryId) : null,
          title: invTitle,
          totalAmount: Number(invAmount),
          dueDate: invDueDate,
        }),
      });
      setShowInvoiceModal(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setError(null);
    try {
      await apiRequest('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: payingInvoice.id,
          amount: Number(payAmount),
          paymentMethod: payMethod,
          paymentProviderRef: payRef,
          notes: payNotes,
        }),
      });
      setPayingInvoice(null);
      setPayRef('');
      setPayNotes('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/finance/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catName,
          type: catType,
          defaultAmount: Number(catAmount),
        }),
      });
      setCatName('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const currency = school?.currency || 'XOF';
  if (loading || !data) {
    return (
      <SurfaceCard padding="none">
        <TableSkeleton rows={6} cols={5} />
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Scolarité & Finances' : 'School Fees & Finance'}
        subtitle={
          <>
            Devise : <span className="font-mono-tabular font-semibold">{currency}</span> ·
            Passerelles prêtes : FedaPay & Kkiapay
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportToExcel(
                  data.invoices.map((i: any) => ({
                    Facture: i.invoiceNumber,
                    Élève: i.studentName,
                    Libellé: i.title,
                    MontantTotal: i.totalAmount,
                    Payé: i.paidAmount,
                    Reste: i.balance,
                    Statut: i.status,
                  })),
                  'Finances',
                  'EDUSMART_Etat_Financier'
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
                  'État Financier des Frais Scolaires',
                  `Taux de recouvrement : ${data.summary.collectionRate}%`,
                  ['N° Facture', 'Élève', 'Libellé', 'Total', 'Payé', 'Solde'],
                  data.invoices.map((i: any) => [
                    i.invoiceNumber,
                    i.studentName,
                    i.title,
                    formatCurrency(i.totalAmount, currency),
                    formatCurrency(i.paidAmount, currency),
                    formatCurrency(i.balance, currency),
                  ]),
                  'EDUSMART_Etat_Financier',
                  school?.name
                )
              }
            >
              <Download className="h-4 w-4 text-[#0F2744] dark:text-blue-400" />
              <span>PDF</span>
            </Button>
            <Button variant="primary" onClick={() => setShowInvoiceModal(true)}>
              <Plus className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Nouvelle facture' : 'Create Invoice'}</span>
            </Button>
          </>
        }
      />

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SurfaceCard>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total facturé</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#0F2744] dark:text-white">
            <AnimatedNumber
              value={data.summary.totalExpected}
              formatter={(v) => formatCurrency(v, currency)}
            />
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total encaissé</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-emerald-700 dark:text-emerald-400">
            <AnimatedNumber
              value={data.summary.totalCollected}
              formatter={(v) => formatCurrency(v, currency)}
            />
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-slate-500 dark:text-slate-400">Reste à recouvrer</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-amber-700 dark:text-amber-400">
            <AnimatedNumber
              value={data.summary.totalOutstanding}
              formatter={(v) => formatCurrency(v, currency)}
            />
          </p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="text-xs text-slate-500 dark:text-slate-400">Taux de recouvrement</p>
          <p className="mt-1.5 font-mono-tabular text-xl font-bold text-[#1E40AF] dark:text-blue-400">
            {data.summary.collectionRate}%
          </p>
        </SurfaceCard>
      </div>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'invoices', label: `Factures & Soldes (${data.invoices.length})` },
          { id: 'payments', label: `Historique des Paiements (${data.payments.length})` },
          { id: 'categories', label: `Catégories de Frais (${data.categories.length})` },
        ]}
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      {tab === 'invoices' && (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Facture</th>
                  <th className="px-4 py-3 font-semibold">Élève</th>
                  <th className="px-4 py-3 font-semibold">Libellé</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Payé</th>
                  <th className="px-4 py-3 font-semibold">Reste</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {inv.studentName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {inv.className}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{inv.title}</td>
                    <td className="px-4 py-3 font-mono-tabular">
                      {formatCurrency(inv.totalAmount, currency)}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(inv.paidAmount, currency)}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-amber-700 dark:text-amber-400">
                      {formatCurrency(inv.balance, currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold capitalize text-slate-700 dark:text-slate-300">
                      {inv.status}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.balance > 0 ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setPayingInvoice(inv);
                            setPayAmount(inv.balance);
                          }}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          <span>Encaisser</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Soldée
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Aucune facture émise.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      {tab === 'payments' && (
        <SurfaceCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reçu</th>
                  <th className="px-4 py-3 font-semibold">Élève</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Mode / Passerelle</th>
                  <th className="px-4 py-3 font-semibold">Montant</th>
                  <th className="px-4 py-3 text-right font-semibold">Quittance PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono-tabular font-semibold text-[#0F2744] dark:text-blue-400">
                      {p.receiptNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {p.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600 dark:text-slate-400">
                      {p.paidAt}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-700 dark:text-slate-300">
                      {p.paymentMethod} {p.paymentProviderRef ? `(${p.paymentProviderRef})` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(p.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportReceiptPdf(p, {
                            name: school?.name || 'EDUSMART',
                            city: school?.city,
                            country: school?.country,
                            phone: school?.phone,
                            currency,
                          })
                        }
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Reçu PDF</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <SurfaceCard className="lg:col-span-4 h-fit">
            <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
              <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                Nouvelle catégorie de frais
              </h2>
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="ex: Frais de cantine / transport"
                className={inputBaseClass}
              />
              <select
                value={catType}
                onChange={(e) => setCatType(e.target.value)}
                className={inputBaseClass}
              >
                <option value="tuition">Scolarité</option>
                <option value="registration">Inscription</option>
                <option value="exam">Examen</option>
                <option value="transport">Transport</option>
                <option value="canteen">Cantine</option>
                <option value="other">Autre</option>
              </select>
              <input
                type="number"
                value={catAmount}
                onChange={(e) => setCatAmount(Number(e.target.value))}
                className={`${inputBaseClass} font-mono-tabular`}
              />
              <Button type="submit" variant="primary" className="w-full">
                Enregistrer la catégorie
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard className="lg:col-span-8">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.categories.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {c.type} · {c.frequency}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#0F2744] dark:text-blue-400">
                    {formatCurrency(c.defaultAmount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* Invoice Modal */}
      <ModalDialog
        open={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        maxWidth="max-w-md"
        title="Émettre une facture"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setInvTargetType('student')}
              className={`rounded-lg py-1.5 font-semibold cursor-pointer ${
                invTargetType === 'student'
                  ? 'bg-white dark:bg-slate-700 text-[#0F2744] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Par élève
            </button>
            <button
              type="button"
              onClick={() => setInvTargetType('class')}
              className={`rounded-lg py-1.5 font-semibold cursor-pointer ${
                invTargetType === 'class'
                  ? 'bg-white dark:bg-slate-700 text-[#0F2744] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Toute une classe
            </button>
          </div>

          {invTargetType === 'student' ? (
            <select
              required
              value={invStudentId}
              onChange={(e) => setInvStudentId(e.target.value)}
              className={inputBaseClass}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.registrationNumber})
                </option>
              ))}
            </select>
          ) : (
            <select
              required
              value={invClassId}
              onChange={(e) => setInvClassId(e.target.value)}
              className={inputBaseClass}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={invCategoryId}
            onChange={(e) => {
              setInvCategoryId(e.target.value);
              const found = data.categories.find((c: any) => String(c.id) === e.target.value);
              if (found) {
                setInvTitle(found.name);
                setInvAmount(found.defaultAmount);
              }
            }}
            className={inputBaseClass}
          >
            <option value="">Catégorie personnalisée</option>
            {data.categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({formatCurrency(c.defaultAmount, currency)})
              </option>
            ))}
          </select>

          <input
            required
            value={invTitle}
            onChange={(e) => setInvTitle(e.target.value)}
            placeholder="Libellé de facture"
            className={inputBaseClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              required
              min={1}
              value={invAmount}
              onChange={(e) => setInvAmount(Number(e.target.value))}
              className={`${inputBaseClass} font-mono-tabular`}
            />
            <input
              type="date"
              required
              value={invDueDate}
              onChange={(e) => setInvDueDate(e.target.value)}
              className={inputBaseClass}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" size="lg">
            Créer la facture
          </Button>
        </form>
      </ModalDialog>

      {/* Payment Modal */}
      <ModalDialog
        open={!!payingInvoice}
        onClose={() => setPayingInvoice(null)}
        maxWidth="max-w-md"
        title={
          payingInvoice ? `Enregistrer un règlement — ${payingInvoice.invoiceNumber}` : undefined
        }
      >
        {payingInvoice && (
          <div className="text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              {payingInvoice.studentName} · Solde restant :{' '}
              <span className="font-mono-tabular font-bold text-amber-700 dark:text-amber-400">
                {formatCurrency(payingInvoice.balance, currency)}
              </span>
            </p>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Montant versé (partiel ou total)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payingInvoice.balance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className={`mt-1 ${inputBaseClass} font-mono-tabular`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Mode de paiement
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className={`mt-1 ${inputBaseClass}`}
                >
                  <option value="cash">Espèces (Caisse école)</option>
                  <option value="fedapay">FedaPay (MTN / Moov Mobile Money)</option>
                  <option value="kkiapay">Kkiapay (Mobile Money / Carte)</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="check">Chèque</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Référence transaction (FedaPay / Kkiapay / Bordereau)
                </label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="ex: FDP-482910"
                  className={`mt-1 ${inputBaseClass} font-mono-tabular`}
                />
              </div>

              <Button type="submit" variant="primary" className="w-full" size="lg">
                Valider & Générer le reçu
              </Button>
            </form>
          </div>
        )}
      </ModalDialog>
    </div>
  );
};
