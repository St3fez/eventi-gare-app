import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { EventItem, PaymentIntentRecord, RegistrationRecord } from '../types';
import { formatDate, formatEventSchedule, toMoney } from '../utils/format';

type PdfLibRuntime = {
  PDFDocument: typeof import('pdf-lib')['PDFDocument'];
  StandardFonts: typeof import('pdf-lib')['StandardFonts'];
  rgb: typeof import('pdf-lib')['rgb'];
};

let pdfLibRuntimePromise: Promise<PdfLibRuntime> | null = null;

const loadPdfLibRuntime = async (): Promise<PdfLibRuntime> => {
  if (pdfLibRuntimePromise) {
    return pdfLibRuntimePromise;
  }

  pdfLibRuntimePromise = (async () => {
    try {
      const module = await import('pdf-lib');
      return module as PdfLibRuntime;
    } catch {
      const fallback = await import('pdf-lib/dist/pdf-lib.esm.js');
      return fallback as unknown as PdfLibRuntime;
    }
  })();

  return pdfLibRuntimePromise;
};

const sanitizePdfText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');

const wrapText = (
  text: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] => {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [''];
  }

  const lines: string[] = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const nextWord = words[index];
    const candidate = `${current} ${nextWord}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = nextWord;
    }
  }

  lines.push(current);
  return lines;
};

const uint8ToBase64 = (bytes: Uint8Array): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;

    const buffer = (first << 16) | (second << 8) | third;

    output += alphabet[(buffer >> 18) & 63];
    output += alphabet[(buffer >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(buffer >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? alphabet[buffer & 63] : '=';
  }

  return output;
};

export const exportEventRegistrationsPdf = async (
  event: EventItem,
  registrations: RegistrationRecord[],
  paymentIntents: PaymentIntentRecord[]
): Promise<{ ok: true; uri?: string } | { ok: false; reason: string }> => {
  if (!registrations.length) {
    return { ok: false, reason: 'Nessun iscritto da esportare.' };
  }

  const { PDFDocument, StandardFonts, rgb } = await loadPdfLibRuntime();

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 38;
  const lineHeight = 13;
  const maxWidth = pageWidth - margin * 2;
  const paymentIntentById = new Map(paymentIntents.map((entry) => [entry.id, entry]));

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed >= margin) {
      return;
    }
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const drawWrapped = (text: string, size = 10.5, bold = false) => {
    const selectedFont = bold ? boldFont : font;
    const lines = wrapText(text, maxWidth, (value) => selectedFont.widthOfTextAtSize(value, size));
    ensureSpace(lines.length * lineHeight + 2);
    lines.forEach((line) => {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: selectedFont,
        color: rgb(0.08, 0.13, 0.2),
      });
      y -= lineHeight;
    });
  };

  drawWrapped(`Eventi - Export partecipanti`, 14, true);
  y -= 4;
  drawWrapped(`Evento: ${event.name}`, 11, true);
  drawWrapped(`Luogo: ${event.location}`);
  drawWrapped(`Data evento: ${formatEventSchedule(event)}`);
  drawWrapped(`Generato il: ${new Date().toLocaleString('it-IT')}`);
  y -= 5;
  drawWrapped(`Totale iscritti: ${registrations.length}`, 10.5, true);
  y -= 6;

  registrations.forEach((entry, index) => {
    const intent = entry.paymentIntentId ? paymentIntentById.get(entry.paymentIntentId) : undefined;
    const header = `${index + 1}. ${entry.fullName} - ${entry.email}`;
    const payment = `Stato iscrizione: ${entry.registrationStatus} | Stato pagamento: ${
      entry.paymentStatus
    } | Importo: ${toMoney(entry.paymentAmount)} | Commissione: ${toMoney(entry.commissionAmount)}`;
    const details = `Telefono: ${entry.phone || '-'} | Citta: ${entry.city || '-'} | Data nascita: ${
      entry.birthDate || '-'
    } | Partecipanti gruppo: ${entry.groupParticipantsCount || 1}`;
    const refs = `Codice: ${entry.registrationCode} | Numero: ${
      typeof entry.assignedNumber === 'number' ? String(entry.assignedNumber) : '-'
    } | Metodo: ${entry.paymentMethod || '-'} | Ref: ${entry.paymentReference || '-'}`;
    const intentLine = `PaymentIntent: ${entry.paymentIntentId || '-'} | PI status: ${
      intent?.status || '-'
    } | Errore: ${entry.paymentFailedReason || intent?.failureReason || '-'}`;
    const dates = `Creato: ${entry.createdAt} | Aggiornato: ${entry.updatedAt}`;

    drawWrapped(header, 10.8, true);
    drawWrapped(payment);
    drawWrapped(details);
    drawWrapped(refs);
    drawWrapped(intentLine);
    drawWrapped(dates);
    y -= 5;
  });

  const pdfBytes = await doc.save();
  const fileName = `iscritti_${event.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${Date.now()}.pdf`;

  if (Platform.OS === 'web') {
    try {
      const webBytes = Uint8Array.from(pdfBytes);
      const blob = new Blob([webBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return { ok: true, uri: fileName };
    } catch {
      return { ok: false, reason: 'Download PDF non disponibile nel browser.' };
    }
  }

  const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;
  if (!fileUri) {
    return { ok: false, reason: 'Directory file non disponibile.' };
  }

  await FileSystem.writeAsStringAsync(fileUri, uint8ToBase64(pdfBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Condividi elenco iscritti PDF',
    });
    return { ok: true };
  }

  return { ok: true, uri: fileUri };
};
