import React, { useState } from 'react';
import { CreditCard, Download, ExternalLink, Printer } from 'lucide-react';
import {
  buildCardVerificationUrl,
  exportIdCardsPdf,
  IdCardSchoolInfo,
  IdCardStudent,
  PrintableIdCard,
} from '../../lib/exports.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { ModalDialog, Button } from '../ui/DesignSystem.tsx';
import { IdCardFrontBack } from './IdCardTemplates.tsx';

interface IdCardPreviewModalProps {
  card: PrintableIdCard;
  school: IdCardSchoolInfo;
  onClose: () => void;
  onRecordedPrint?: () => void;
}

export const IdCardPreviewModal: React.FC<IdCardPreviewModalProps> = ({
  card,
  school,
  onClose,
  onRecordedPrint,
}) => {
  const { lang } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await exportIdCardsPdf([card], school);
      onRecordedPrint?.();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    onRecordedPrint?.();
    window.print();
  };

  const verifyUrl = card.verificationCode
    ? buildCardVerificationUrl(card.verificationCode)
    : null;

  return (
    <ModalDialog open onClose={onClose} maxWidth="max-w-4xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 pr-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F2744] dark:bg-[#1E40AF] text-white">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F2744] dark:text-white">
              {card.cardType === 'class'
                ? lang === 'fr'
                  ? 'Carte Officielle de Classe (Recto / Verso)'
                  : 'Class Identification Card (Front / Back)'
                : card.cardType === 'teacher'
                ? lang === 'fr'
                  ? 'Carte Professionnelle Enseignant (Recto / Verso)'
                  : 'Teacher / Staff ID Card (Front / Back)'
                : lang === 'fr'
                ? "Carte d'Identité Scolaire (Recto / Verso)"
                : 'Student School ID Card (Front / Back)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'fr'
                ? 'Le QR code au verso permet la vérification instantanée en ligne et le pointage à l’entrée.'
                : 'The back QR code opens the secure verification page and supports entrance attendance scanning.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{lang === 'fr' ? 'Imprimer' : 'Print'}</span>
          </Button>
          <Button variant="primary" disabled={downloading} onClick={handleDownloadPdf}>
            <Download className="h-4 w-4" />
            <span>
              {downloading
                ? lang === 'fr'
                  ? 'Génération...'
                  : 'Generating...'
                : lang === 'fr'
                ? 'Télécharger PDF'
                : 'Download PDF'}
            </span>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <IdCardFrontBack card={card} school={school} />
      </div>

      <div className="no-print mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
        {verifyUrl ? (
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>
              {lang === 'fr'
                ? 'Tester la page de vérification QR'
                : 'Open QR Verification Page'}
            </span>
          </a>
        ) : (
          <span className="text-slate-400 font-mono-tabular">{card.holderCode}</span>
        )}
        <Button variant="outline" onClick={onClose}>
          {lang === 'fr' ? 'Fermer' : 'Close'}
        </Button>
      </div>
    </ModalDialog>
  );
};

// Backwards-compatible wrapper for StudentModal imports
export const StudentIdCardModal: React.FC<{
  student: IdCardStudent;
  school: IdCardSchoolInfo;
  academicYear?: string;
  onClose: () => void;
}> = ({ student, school, academicYear = '2026-2027', onClose }) => {
  const card: PrintableIdCard = {
    cardType: 'student',
    cardNumber: student.cardNumber || `STU-${student.registrationNumber}`,
    holderName: `${student.firstName} ${student.lastName}`.trim(),
    holderCode: student.registrationNumber,
    designationOrClass: student.className,
    academicYearOrStatus: student.academicYearName || academicYear,
    photoUrl: student.photoUrl,
    verificationCode: student.verificationCode,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    status: 'active',
  };
  return <IdCardPreviewModal card={card} school={school} onClose={onClose} />;
};
