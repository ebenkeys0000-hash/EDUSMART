import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, HelpCircle, Mic, MicOff, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import {
  PageHeader,
  SurfaceCard,
  Button,
  inputBaseClass,
  AlertBanner,
} from '../ui/DesignSystem.tsx';
import { BrandLogo } from '../ui/BrandLogo.tsx';

export const CommunicationModule: React.FC = () => {
  const { lang, user, school } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('all');
  const [channel, setChannel] = useState('portal');
  const [eventDate, setEventDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isListening, setIsListening] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const [supSubject, setSupSubject] = useState('');
  const [supMsg, setSupMsg] = useState('');
  const [supSuccess, setSupSuccess] = useState(false);

  const load = async () => {
    const res = await apiRequest<{ items: any[] }>('/api/communication/announcements');
    setItems(res.items);
  };

  useEffect(() => {
    load().catch(() => {});
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const canPublish =
    user?.role === 'school_admin' || user?.role === 'super_admin' || user?.role === 'teacher';

  const toggleVoiceDictation = async () => {
    setMicStatus(null);
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionCtor) {
        setMicStatus(
          lang === 'fr'
            ? 'Microphone autorisé. La dictée vocale directe nécessite Chrome ou Edge.'
            : 'Microphone permitted. Direct voice dictation requires Chrome or Edge.'
        );
        return;
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          setContent((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setMicStatus(
        lang === 'fr'
          ? 'Accès au microphone refusé par le navigateur.'
          : 'Microphone access was denied by the browser.'
      );
      setIsListening(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/communication/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, content, audience, channel, eventDate, priority }),
    });
    setTitle('');
    setContent('');
    setEventDate('');
    await load();
  };

  const handleSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/communication/support', {
      method: 'POST',
      body: JSON.stringify({ subject: supSubject, message: supMsg }),
    });
    setSupSubject('');
    setSupMsg('');
    setSupSuccess(true);
    setTimeout(() => setSupSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === 'fr' ? 'Communication & Événements' : 'Communication & Events'}
        subtitle="Annonces internes, notifications parents/enseignants et architecture prête pour Email & SMS"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          {canPublish && (
            <SurfaceCard>
              <form onSubmit={handlePublish} className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-[#0F2744] dark:text-white">
                    {lang === 'fr' ? 'Publier une annonce ou événement' : 'Publish Announcement'}
                  </h2>
                  <button
                    type="button"
                    onClick={toggleVoiceDictation}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      isListening
                        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        <span>{lang === 'fr' ? 'Arrêter dictée' : 'Stop dictation'}</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" />
                        <span>{lang === 'fr' ? 'Dicter au micro' : 'Voice dictate'}</span>
                      </>
                    )}
                  </button>
                </div>
                {micStatus && <AlertBanner type="info">{micStatus}</AlertBanner>}
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Objet de l'annonce"
                  className={inputBaseClass}
                />
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Message destiné aux destinataires..."
                  className={inputBaseClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="all">Tout l&apos;établissement</option>
                    <option value="parents">Parents uniquement</option>
                    <option value="teachers">Enseignants uniquement</option>
                    <option value="students">Élèves uniquement</option>
                  </select>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="portal">Portail EDUSMART</option>
                    <option value="email_ready">Portail + Email prêt</option>
                    <option value="sms_ready">Portail + SMS prêt</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={inputBaseClass}
                  />
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={inputBaseClass}
                  >
                    <option value="normal">Priorité normale</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                {channel === 'email_ready' && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <BrandLogo size="xs" />
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#0068C9] dark:text-blue-400">
                        <Mail className="h-3 w-3" />
                        <span>{lang === 'fr' ? 'Aperçu Email Automatique' : 'Automated Email Preview'}</span>
                      </span>
                    </div>
                    <p className="font-bold text-[#082F5E] dark:text-white truncate">
                      {title || (lang === 'fr' ? 'Objet de la notification...' : 'Notification subject...')}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {content || (lang === 'fr' ? "Le corps du message sera envoyé avec l'en-tête officiel de votre établissement et EduSmart." : 'Message body will be dispatched with official EduSmart & school letterhead.')}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {school?.name || 'EduSmart'} · Apprendre • Progresser • Réussir
                    </p>
                  </div>
                )}
                <Button type="submit" variant="primary" className="w-full" size="lg">
                  <Send className="h-4 w-4" />
                  <span>Diffuser l&apos;annonce</span>
                </Button>
              </form>
            </SurfaceCard>
          )}

          {/* Support request to EDUSMART */}
          <SurfaceCard>
            <form onSubmit={handleSupport} className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-[#082F5E] dark:text-blue-400" />
                  <h2 className="font-display text-sm font-bold text-[#082F5E] dark:text-white">
                    Contacter le support EDUSMART
                  </h2>
                </div>
                <BrandLogo size="xs" />
              </div>
              {supSuccess && (
                <AlertBanner type="success">
                  Demande transmise au Super Administrateur EDUSMART.
                </AlertBanner>
              )}
              <input
                required
                value={supSubject}
                onChange={(e) => setSupSubject(e.target.value)}
                placeholder="Sujet de la demande"
                className={inputBaseClass}
              />
              <textarea
                required
                rows={2}
                value={supMsg}
                onChange={(e) => setSupMsg(e.target.value)}
                placeholder="Décrivez votre besoin..."
                className={inputBaseClass}
              />
              <Button type="submit" variant="outline" className="w-full">
                Envoyer au support
              </Button>
            </form>
          </SurfaceCard>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {items.map((a) => (
            <SurfaceCard key={a.id} className="text-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#0F2744] dark:text-white">
                    {a.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Public : {a.audience} · Canal : {a.channel} · Par {a.authorName}
                    {a.eventDate ? ` · Événement : ${a.eventDate}` : ''}
                  </p>
                </div>
                {(user?.role === 'school_admin' || user?.role === 'super_admin') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/communication/announcements/${a.id}`, {
                        method: 'DELETE',
                      });
                      load();
                    }}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-3 leading-relaxed text-slate-700 dark:text-slate-300">
                {a.content}
              </p>
            </SurfaceCard>
          ))}
          {items.length === 0 && (
            <SurfaceCard className="p-8 text-center text-xs text-slate-400">
              Aucune annonce publiée pour le moment.
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
};
