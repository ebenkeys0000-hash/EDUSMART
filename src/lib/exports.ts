import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { formatCurrency } from './i18n.ts';
import { EDUSMART_LOGO_URL } from './subscriptionCatalog.ts';

export interface IdCardStudent {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth?: string;
  className: string;
  photoUrl?: string;
  academicYearName?: string;
  verificationCode?: string;
  cardNumber?: string;
  parentName?: string;
  parentPhone?: string;
  emergencyContact?: string;
}

export interface ClassCardMeta {
  classNameFr?: string;
  classNameEn?: string;
  level?: string;
  room?: string;
  capacity?: number;
  studentCount?: number;
  teacherName?: string;
  seriesName?: string;
  specializationName?: string;
}

export interface PrintableIdCard {
  cardType: 'student' | 'teacher' | 'class';
  cardNumber?: string;
  holderName: string;
  holderCode: string;
  designationOrClass: string;
  academicYearOrStatus: string;
  photoUrl?: string;
  verificationCode?: string;
  status?: string;
  gender?: string;
  dateOfBirth?: string;
  assignedClasses?: string[];
  issuedAt?: string;
  classMeta?: ClassCardMeta;
}

export interface IdCardSchoolInfo {
  name: string;
  code: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
}

async function resolveImageDataUrl(src?: string): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  if (!src) return null;
  if (src.startsWith('data:image/')) {
    const format = src.includes('image/png') ? 'PNG' : 'JPEG';
    return { dataUrl: src, format };
  }
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith('data:image/')) return null;
    const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export function buildCardVerificationUrl(verificationCode?: string, fallbackPayload?: string): string {
  if (verificationCode) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://edusmart.app';
    return `${origin}/?verify=${encodeURIComponent(verificationCode)}`;
  }
  return fallbackPayload || 'EDUSMART';
}

export async function exportIdCardsPdf(cardsList: PrintableIdCard[], school: IdCardSchoolInfo) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cardW = 85.6;
  const cardH = 54;
  const startX = 14;
  const gapX = 10;
  const startY = 18;
  const gapY = 10;

  const [schoolLogo, edusmartLogo] = await Promise.all([
    resolveImageDataUrl(school.logoUrl),
    resolveImageDataUrl(EDUSMART_LOGO_URL),
  ]);

  doc.setFontSize(11);
  doc.setTextColor(15, 39, 68);
  doc.text(`${school.name} — Cartes d'Identification Officielles (Recto / Verso)`, 14, 11);

  for (let i = 0; i < cardsList.length; i++) {
    const card = cardsList[i];
    const rowOnPage = i % 4;
    if (i > 0 && rowOnPage === 0) {
      doc.addPage();
      doc.setFontSize(11);
      doc.setTextColor(15, 39, 68);
      doc.text(`${school.name} — Cartes d'Identification Officielles (Suite)`, 14, 11);
    }

    const y = startY + rowOnPage * (cardH + gapY);
    const frontX = startX;
    const backX = startX + cardW + gapX;
    const isTeacher = card.cardType === 'teacher';
    const isClass = card.cardType === 'class';

    // --- RECTO (FRONT) ---
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(frontX, y, cardW, cardH, 3, 3, 'FD');

    // Header band: Deep Navy for Students, Royal Blue for Teachers, Slate-Navy Blue for Class Cards
    if (isTeacher) {
      doc.setFillColor(30, 64, 175);
    } else if (isClass) {
      doc.setFillColor(2, 132, 199);
    } else {
      doc.setFillColor(15, 39, 68);
    }
    doc.roundedRect(frontX, y, cardW, 13.5, 3, 3, 'F');
    doc.rect(frontX, y + 8, cardW, 5.5, 'F');

    if (schoolLogo) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(frontX + cardW - 12.5, y + 2, 9.5, 9.5, 1.5, 1.5, 'F');
        doc.addImage(schoolLogo.dataUrl, schoolLogo.format, frontX + cardW - 12, y + 2.5, 8.5, 8.5);
      } catch {
        // ignore logo render issue
      }
    } else if (edusmartLogo) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(frontX + cardW - 16, y + 2, 13.5, 9, 1.5, 1.5, 'F');
        doc.addImage(edusmartLogo.dataUrl, edusmartLogo.format, frontX + cardW - 15.2, y + 2.5, 12, 8);
      } catch {
        // ignore
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(school.name.toUpperCase().slice(0, 32), frontX + 4, y + 5.5);
    doc.setFontSize(6.4);
    doc.setTextColor(219, 234, 254);
    doc.text(
      isClass
        ? `CARTE OFFICIELLE DE CLASSE · ${card.academicYearOrStatus || '2026-2027'}`.slice(0, 44)
        : isTeacher
        ? `CARTE PERSONNEL ENSEIGNANT · ${card.academicYearOrStatus || 'ACTIF'}`.slice(0, 44)
        : `CARTE SCOLAIRE ÉLÈVE · ${card.academicYearOrStatus || '2026-2027'}`.slice(0, 44),
      frontX + 4,
      y + 10.5
    );

    if (isClass) {
      const meta = card.classMeta || {};
      doc.setDrawColor(219, 234, 254);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(frontX + 4, y + 16, 20.5, 25.5, 1.5, 1.5, 'FD');
      if (schoolLogo) {
        try {
          doc.addImage(schoolLogo.dataUrl, schoolLogo.format, frontX + 5.2, y + 19.5, 18, 18);
        } catch {
          doc.setTextColor(15, 39, 68);
          doc.setFontSize(8);
          doc.text('CLASSE', frontX + 7.5, y + 30);
        }
      } else {
        doc.setTextColor(15, 39, 68);
        doc.setFontSize(8);
        doc.text('CLASSE', frontX + 7.5, y + 30);
      }

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(card.holderName.slice(0, 26), frontX + 27.5, y + 20.5);

      doc.setFontSize(7.5);
      doc.setTextColor(30, 64, 175);
      doc.text(`N° Classe : ${card.holderCode}`, frontX + 27.5, y + 25.8);

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.text(
        `Titulaire : ${(meta.teacherName || 'Non assigné').slice(0, 26)}`,
        frontX + 27.5,
        y + 31
      );
      doc.text(
        `Effectif : ${meta.studentCount ?? 0} / ${meta.capacity ?? 40} élèves${
          meta.room ? ` · ${meta.room}` : ''
        }`.slice(0, 34),
        frontX + 27.5,
        y + 36
      );
      doc.text(
        `${meta.level || ''}${meta.seriesName ? ` · ${meta.seriesName}` : ''}`.slice(0, 34),
        frontX + 27.5,
        y + 41
      );
    } else {
      // Photo frame
      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(frontX + 4, y + 16, 20.5, 25.5, 1.5, 1.5, 'FD');

      const resolvedPhoto = await resolveImageDataUrl(card.photoUrl);
      if (resolvedPhoto) {
        try {
          doc.addImage(resolvedPhoto.dataUrl, resolvedPhoto.format, frontX + 4.4, y + 16.4, 19.7, 24.7);
        } catch {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(7);
          doc.text('PHOTO', frontX + 9.5, y + 30);
        }
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.text('PHOTO', frontX + 9.5, y + 30);
      }

      // Holder details
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.text(card.holderName.slice(0, 26), frontX + 27.5, y + 20.5);

      doc.setFontSize(7.5);
      doc.setTextColor(30, 64, 175);
      doc.text(
        (isTeacher ? card.designationOrClass : `Classe : ${card.designationOrClass}`).slice(0, 34),
        frontX + 27.5,
        y + 25.8
      );

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(7);
      doc.text(
        `${isTeacher ? 'Code Staff' : 'Matricule'} : ${card.holderCode}`,
        frontX + 27.5,
        y + 31
      );

      if (isTeacher) {
        const classesSummary =
          card.assignedClasses && card.assignedClasses.length > 0
            ? `Classes : ${card.assignedClasses.slice(0, 3).join(', ')}`
            : `Statut : ${card.academicYearOrStatus || 'Actif'}`;
        doc.text(classesSummary.slice(0, 35), frontX + 27.5, y + 36);
      } else {
        doc.text(
          `Né(e) le : ${card.dateOfBirth || '—'} · Sexe : ${card.gender || 'M'}`,
          frontX + 27.5,
          y + 36
        );
      }

      doc.text(
        `${school.city || ''}, ${school.country || ''}`.replace(/^,\s*|,\s*$/g, '').slice(0, 34),
        frontX + 27.5,
        y + 41
      );
    }

    // Bottom strip
    doc.setFillColor(241, 245, 249);
    doc.rect(frontX + 0.5, y + 46, cardW - 1, 7.5, 'F');
    doc.setTextColor(15, 39, 68);
    doc.setFontSize(6.4);
    doc.text(`ID : ${card.cardNumber || card.holderCode}`, frontX + 4, y + 50.8);
    doc.text(
      isClass ? 'CLASSE · RECTO' : isTeacher ? 'PERSONNEL · RECTO' : 'ÉLÈVE · RECTO',
      frontX + cardW - 24,
      y + 50.8
    );

    // --- VERSO (BACK) ---
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(backX, y, cardW, cardH, 3, 3, 'FD');

    doc.setTextColor(15, 39, 68);
    doc.setFontSize(7.2);
    doc.text(
      isClass
        ? 'VÉRIFICATION OFFICIELLE CLASSE'
        : isTeacher
        ? 'VÉRIFICATION OFFICIELLE PERSONNEL'
        : 'VÉRIFICATION & CONTRÔLE PRÉSENCE',
      backX + 4,
      y + 7
    );

    const qrPayload = buildCardVerificationUrl(
      card.verificationCode,
      `EDUSMART:${school.code}:${card.holderCode}`
    );
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 240,
      margin: 1,
      color: { dark: '#0F2744', light: '#FFFFFF' },
    });
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(backX + 4, y + 11, 31, 31, 1.5, 1.5, 'FD');
    doc.addImage(qrDataUrl, 'PNG', backX + 5, y + 12, 29, 29);

    doc.setFontSize(6.6);
    doc.setTextColor(51, 65, 85);
    doc.text('Scannez ce QR code pour', backX + 38, y + 15);
    doc.text("vérifier l'authenticité et", backX + 38, y + 19);
    doc.text('le statut actif de la carte.', backX + 38, y + 23);

    doc.setTextColor(15, 23, 42);
    doc.text(`Code : ${(card.verificationCode || card.holderCode).slice(0, 22)}`, backX + 38, y + 30);
    doc.text(`Tél École : ${(school.phone || '—').slice(0, 22)}`, backX + 38, y + 35);
    doc.text(
      `${(school.city || school.address || school.email || '').slice(0, 28)}`,
      backX + 38,
      y + 40
    );

    if (edusmartLogo) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(backX + cardW - 29, y + 43.5, 13.5, 9, 1.2, 1.2, 'F');
        doc.addImage(edusmartLogo.dataUrl, edusmartLogo.format, backX + cardW - 28.2, y + 44, 12, 8);
      } catch {
        // ignore
      }
    }

    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Carte officielle · ${school.name.slice(0, 24)}`,
      backX + 4,
      y + 49.5
    );
    doc.text('VERSO', backX + cardW - 13, y + 49.5);
  }

  const fileSlug =
    cardsList.length === 1
      ? `Carte_${
          cardsList[0].cardType === 'class'
            ? 'Classe'
            : cardsList[0].cardType === 'teacher'
            ? 'Enseignant'
            : 'Scolaire'
        }_${cardsList[0].holderCode}`
      : `Cartes_Officielles_Lot_${cardsList.length}`;
  doc.save(`${fileSlug}.pdf`);
}

export async function exportStudentIdCardsPdf(
  studentsList: IdCardStudent[],
  school: IdCardSchoolInfo,
  academicYear = '2026-2027'
) {
  const mapped: PrintableIdCard[] = studentsList.map((st) => ({
    cardType: 'student',
    cardNumber: st.cardNumber || `STU-${st.registrationNumber}`,
    holderName: `${st.firstName} ${st.lastName}`.trim(),
    holderCode: st.registrationNumber,
    designationOrClass: st.className,
    academicYearOrStatus: st.academicYearName || academicYear,
    photoUrl: st.photoUrl,
    verificationCode: st.verificationCode,
    gender: st.gender,
    dateOfBirth: st.dateOfBirth,
  }));
  return exportIdCardsPdf(mapped, school);
}

export function exportToExcel(rows: Record<string, unknown>[], sheetName: string, fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export async function exportTableToPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string,
  schoolName = 'EDUSMART'
) {
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const brandLogo = await resolveImageDataUrl(EDUSMART_LOGO_URL);

  doc.setFillColor(8, 47, 94);
  doc.rect(0, 0, pageWidth, 28, 'F');
  if (brandLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 36, 4, 24, 16, 2, 2, 'F');
      doc.addImage(brandLogo.dataUrl, brandLogo.format, pageWidth - 34.5, 5, 21, 14);
    } catch {
      // ignore
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(schoolName.toUpperCase(), 14, 13);
  doc.setFontSize(10);
  doc.text(title, 14, 21);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text(`${subtitle} · Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 36);

  let y = 46;
  const colWidth = (pageWidth - 28) / Math.max(1, headers.length);

  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  headers.forEach((h, idx) => {
    doc.text(String(h).slice(0, 24), 16 + idx * colWidth, y);
  });

  y += 7;
  doc.setFontSize(8);
  rows.forEach((row) => {
    if (y > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, idx) => {
      doc.text(String(cell ?? '').slice(0, 26), 16 + idx * colWidth, y);
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 7;
  });

  doc.save(`${fileName}.pdf`);
}

export async function exportReceiptPdf(
  payment: {
    receiptNumber: string;
    studentName: string;
    registrationNumber?: string;
    amount: number;
    paymentMethod: string;
    paymentProviderRef?: string;
    paidAt: string;
    notes?: string;
  },
  school: { name: string; city?: string; country?: string; phone?: string; currency: string }
) {
  const doc = new jsPDF({ format: 'a5', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const brandLogo = await resolveImageDataUrl(EDUSMART_LOGO_URL);

  doc.setFillColor(8, 47, 94);
  doc.rect(0, 0, w, 28, 'F');
  if (brandLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 4, 24, 16, 2, 2, 'F');
      doc.addImage(brandLogo.dataUrl, brandLogo.format, 13.5, 5, 21, 14);
    } catch {
      // ignore
    }
  }
  const textX = brandLogo ? 41 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(school.name.toUpperCase().slice(0, 34), textX, 12);
  doc.setFontSize(8.5);
  doc.text(`${school.city || ''}, ${school.country || ''} · ${school.phone || ''}`, textX, 19);
  doc.setFontSize(9.5);
  doc.text(`REÇU N° ${payment.receiptNumber}`, w - 62, 14);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('QUITTANCE DE PAIEMENT SCOLAIRE', 14, 40);

  doc.setFontSize(10);
  const lines = [
    `Date de paiement : ${payment.paidAt}`,
    `Élève : ${payment.studentName} ${payment.registrationNumber ? `(${payment.registrationNumber})` : ''}`,
    `Montant encaissé : ${formatCurrency(payment.amount, school.currency)}`,
    `Mode de règlement : ${payment.paymentMethod.toUpperCase()}`,
    payment.paymentProviderRef ? `Référence transaction : ${payment.paymentProviderRef}` : '',
    payment.notes ? `Observations : ${payment.notes}` : '',
  ].filter(Boolean);

  let y = 51;
  lines.forEach((l) => {
    doc.text(l, 14, y);
    y += 9;
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(14, y + 6, w - 14, y + 6);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Cachet & Signature Économat', w - 62, y + 18);
  doc.text('Document officiel généré via EduSmart', 14, y + 18);

  doc.save(`Recu_${payment.receiptNumber}.pdf`);
}

export async function exportReportCardPdf(
  report: {
    studentName: string;
    registrationNumber: string;
    className: string;
    examinationTitle: string;
    examDate: string;
    average: number;
    rank: number;
    mention: string;
    totalCoeff: number;
    weightedSum: number;
    subjects: {
      subjectName: string;
      score: number;
      maxScore: number;
      coefficient: number;
      weightedPoints: number;
      teacherComment: string;
    }[];
  },
  school: { name: string; city?: string; country?: string },
  totalStudentsInClass: number
) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const brandLogo = await resolveImageDataUrl(EDUSMART_LOGO_URL);

  doc.setFillColor(8, 47, 94);
  doc.rect(0, 0, w, 34, 'F');
  if (brandLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 5, 27, 18, 2, 2, 'F');
      doc.addImage(brandLogo.dataUrl, brandLogo.format, 15.5, 6, 24, 16);
    } catch {
      // ignore
    }
  }
  const textX = brandLogo ? 46 : 14;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(school.name.toUpperCase().slice(0, 32), textX, 14);
  doc.setFontSize(9.5);
  doc.text(`${school.city || ''}, ${school.country || ''}`, textX, 22);
  doc.text('BULLETIN DE NOTES OFFICIEL', w - 68, 16);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Élève : ${report.studentName}`, 14, 46);
  doc.text(`Matricule : ${report.registrationNumber}`, 14, 53);
  doc.text(`Classe : ${report.className}`, 120, 46);
  doc.text(`Session : ${report.examinationTitle}`, 120, 53);

  let y = 67;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 6, w - 28, 9, 'F');
  doc.setFontSize(9);
  doc.text('Matière', 16, y);
  doc.text('Note', 90, y);
  doc.text('Coeff', 112, y);
  doc.text('Total', 132, y);
  doc.text('Appréciation', 154, y);

  y += 9;
  report.subjects.forEach((s) => {
    doc.text(s.subjectName.slice(0, 32), 16, y);
    doc.text(`${s.score} / ${s.maxScore}`, 90, y);
    doc.text(String(s.coefficient), 114, y);
    doc.text(String(s.weightedPoints), 132, y);
    doc.text((s.teacherComment || '—').slice(0, 22), 154, y);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 2.5, w - 14, y + 2.5);
    y += 8;
  });

  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 6, w - 28, 22, 'F');
  doc.setFontSize(10.5);
  doc.text(`Moyenne Générale : ${report.average.toFixed(2)} / 20`, 18, y + 2);
  doc.text(`Rang : ${report.rank}e / ${totalStudentsInClass}`, 105, y + 2);
  doc.text(`Mention : ${report.mention}`, 18, y + 10);
  doc.text(`Total Coefficients : ${report.totalCoeff}`, 105, y + 10);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('La Direction des Études', w - 55, y + 34);
  doc.text(`Édité le ${new Date().toLocaleDateString('fr-FR')} via EduSmart`, 14, y + 34);

  doc.save(`Bulletin_${report.registrationNumber}.pdf`);
}

export async function exportSubscriptionInvoicePdf(
  payment: {
    invoiceNumber: string;
    planName: string;
    billingCycle: string;
    amountXof: number;
    discountAmountXof?: number;
    paymentMethod: string;
    paymentReference?: string;
    status: string;
    periodStart?: string;
    periodEnd?: string;
    paidAt?: string;
  },
  school: { name: string; code?: string; email?: string; city?: string; country?: string }
) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const brandLogo = await resolveImageDataUrl(EDUSMART_LOGO_URL);

  doc.setFillColor(8, 47, 94);
  doc.rect(0, 0, w, 36, 'F');
  if (brandLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, 6, 30, 20, 2.5, 2.5, 'F');
      doc.addImage(brandLogo.dataUrl, brandLogo.format, 15.5, 7, 27, 18);
    } catch {
      // ignore
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('FACTURE ABONNEMENT EDUSMART', w - 95, 16);
  doc.setFontSize(10);
  doc.text(`N° ${payment.invoiceNumber}`, w - 95, 24);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Établissement : ${school.name}`, 14, 50);
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Code : ${school.code || '—'} · ${school.city || ''}, ${school.country || ''}`, 14, 57);
  if (school.email) doc.text(`Email : ${school.email}`, 14, 63);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 72, w - 28, 62, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.text(`Forfait : ${payment.planName}`, 20, 84);
  doc.text(
    `Cycle de facturation : ${payment.billingCycle === 'annual' ? 'Annuel (-20 %)' : 'Mensuel'}`,
    20,
    93
  );
  doc.text(
    `Période couverte : ${payment.periodStart || '—'} au ${payment.periodEnd || '—'}`,
    20,
    102
  );
  doc.text(`Méthode : ${payment.paymentMethod.toUpperCase()} · Réf : ${payment.paymentReference || '—'}`, 20, 111);
  doc.text(
    `Statut : ${payment.status === 'paid' ? 'PAYÉE & VALIDÉE' : payment.status.toUpperCase()}`,
    20,
    120
  );

  doc.setFillColor(8, 47, 94);
  doc.roundedRect(14, 142, w - 28, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(`MONTANT TOTAL : ${formatCurrency(payment.amountXof, 'XOF')}`, 20, 154);
  if (payment.discountAmountXof && payment.discountAmountXof > 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(253, 224, 71);
    doc.text(`Économie annuelle incluse : -${formatCurrency(payment.discountAmountXof, 'XOF')}`, 20, 160);
  }

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8.5);
  doc.text('EduSmart — Apprendre • Progresser • Réussir · Plateforme SaaS Éducative', 14, 180);

  doc.save(`Facture_Abonnement_${payment.invoiceNumber}.pdf`);
}
