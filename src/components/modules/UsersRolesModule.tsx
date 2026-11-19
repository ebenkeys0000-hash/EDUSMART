import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
} from '../ui/DesignSystem.tsx';

export const UsersRolesModule: React.FC = () => {
  const { lang } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [linkedStudentId, setLinkedStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [uRes, sRes] = await Promise.all([
      apiRequest<{ items: any[] }>('/api/users/school-users'),
      apiRequest<{ items: any[] }>('/api/students?pageSize=200'),
    ]);
    setUsersList(uRes.items);
    setStudents(sRes.items);
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/users/school-users', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          role,
          linkedStudentId: linkedStudentId ? Number(linkedStudentId) : null,
        }),
      });
      setFullName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateRole = async (id: number, nextRole: string) => {
    await apiRequest(`/api/users/school-users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role: nextRole }),
    });
    await load();
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    await apiRequest(`/api/users/school-users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: currentStatus === 'active' ? 'suspended' : 'active' }),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Utilisateurs & Permissions (RBAC)' : 'Users & Role Permissions'}
        subtitle="Créez les accès pour vos comptables, enseignants, parents et élèves de l'école"
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SurfaceCard className="lg:col-span-4 h-fit">
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
              Créer un compte utilisateur
            </h2>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nom complet"
              className={inputBaseClass}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ecole.bj"
              className={inputBaseClass}
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe provisoire"
              className={inputBaseClass}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputBaseClass}
            >
              <option value="school_admin">Administrateur École</option>
              <option value="accountant">Comptable / Économe</option>
              <option value="teacher">Enseignant</option>
              <option value="parent">Parent d&apos;élève</option>
              <option value="student">Élève</option>
            </select>

            {(role === 'parent' || role === 'student') && (
              <select
                value={linkedStudentId}
                onChange={(e) => setLinkedStudentId(e.target.value)}
                className={inputBaseClass}
              >
                <option value="">Associer à un élève (optionnel)</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.registrationNumber})
                  </option>
                ))}
              </select>
            )}

            <Button type="submit" variant="primary" className="w-full" size="lg">
              <UserPlus className="h-4 w-4" />
              <span>Créer l&apos;accès</span>
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard padding="none" className="overflow-hidden lg:col-span-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Utilisateur</th>
                  <th className="px-4 py-3 font-semibold">Rôle</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{u.fullName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={u.role === 'super_admin'}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
                      >
                        <option value="school_admin">Admin École</option>
                        <option value="accountant">Comptable</option>
                        <option value="teacher">Enseignant</option>
                        <option value="parent">Parent</option>
                        <option value="student">Élève</option>
                        {u.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                      </select>
                    </td>
                    <td className="px-4 py-3 font-medium capitalize">{u.status}</td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'super_admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(u.id, u.status)}
                        >
                          {u.status === 'active' ? 'Suspendre' : 'Réactiver'}
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
