import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
} from '../ui/DesignSystem.tsx';

const DAYS = [
  { id: 1, fr: 'Lundi', en: 'Monday' },
  { id: 2, fr: 'Mardi', en: 'Tuesday' },
  { id: 3, fr: 'Mercredi', en: 'Wednesday' },
  { id: 4, fr: 'Jeudi', en: 'Thursday' },
  { id: 5, fr: 'Vendredi', en: 'Friday' },
  { id: 6, fr: 'Samedi', en: 'Saturday' },
];

export const TimetableModule: React.FC = () => {
  const { lang } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [filterClassId, setFilterClassId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('Salle 101');

  const load = async () => {
    const [ttRes, acadRes, tRes] = await Promise.all([
      apiRequest<{ items: any[] }>('/api/timetables'),
      apiRequest<any>('/api/academics/structure'),
      apiRequest<{ items: any[] }>('/api/teachers'),
    ]);
    setSlots(ttRes.items);
    setClasses(acadRes.classes);
    setSubjects(acadRes.subjects);
    setTeachers(tRes.items);
    if (acadRes.classes[0] && !classId) setClassId(String(acadRes.classes[0].id));
    if (acadRes.subjects[0] && !subjectId) setSubjectId(String(acadRes.subjects[0].id));
    if (tRes.items[0] && !teacherId) setTeacherId(String(tRes.items[0].id));
  };

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/timetables', {
        method: 'POST',
        body: JSON.stringify({
          classId: Number(classId),
          subjectId: Number(subjectId),
          teacherId: Number(teacherId),
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
          room,
        }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const visibleSlots = filterClassId
    ? slots.filter((s) => String(s.classId) === filterClassId)
    : slots;

  return (
    <div className="space-y-5">
      <PageHeader
        title={lang === 'fr' ? 'Emploi du temps & Salles' : 'Timetable Management'}
        subtitle={
          lang === 'fr'
            ? 'Détection automatique des conflits (classe, enseignant et salle)'
            : 'Automatic schedule conflict detection for classes, teachers, and rooms'
        }
        actions={
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className={`${inputBaseClass} w-48 font-medium`}
          >
            <option value="">{lang === 'fr' ? 'Toutes les classes' : 'All Classes'}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      {error && <AlertBanner type="error">{error}</AlertBanner>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SurfaceCard className="lg:col-span-4 h-fit">
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
              {lang === 'fr' ? 'Ajouter un créneau' : 'Add Schedule Slot'}
            </h2>
            <select
              required
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className={inputBaseClass}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={inputBaseClass}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className={inputBaseClass}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className={inputBaseClass}
            >
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {lang === 'fr' ? d.fr : d.en}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`${inputBaseClass} font-mono-tabular`}
              />
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`${inputBaseClass} font-mono-tabular`}
              />
            </div>
            <input
              required
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Salle (ex: B-204)"
              className={inputBaseClass}
            />
            <Button type="submit" variant="primary" className="w-full">
              <Plus className="h-4 w-4" />
              <span>{lang === 'fr' ? 'Planifier le cours' : 'Add Slot'}</span>
            </Button>
          </form>
        </SurfaceCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-8">
          {DAYS.map((day) => {
            const daySlots = visibleSlots.filter((s) => s.dayOfWeek === day.id);
            return (
              <SurfaceCard key={day.id} padding="sm">
                <h3 className="font-display text-sm font-bold text-[#0F2744] dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                  {lang === 'fr' ? day.fr : day.en}
                </h3>
                <div className="mt-3 space-y-2.5 text-xs">
                  {daySlots.length === 0 ? (
                    <p className="text-slate-400">Aucun cours programmé.</p>
                  ) : (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-start justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3"
                      >
                        <div>
                          <p className="font-mono-tabular font-semibold text-[#1E40AF] dark:text-blue-400">
                            {slot.startTime} – {slot.endTime} · {slot.room}
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                            {slot.subjectName} ({slot.className})
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">{slot.teacherName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/timetables/${slot.id}`, { method: 'DELETE' });
                            load();
                          }}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      </div>
    </div>
  );
};
