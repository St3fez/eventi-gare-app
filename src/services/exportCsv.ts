import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { EventItem, PaymentIntentRecord, RegistrationRecord } from '../types';
import { buildCsv } from '../utils/format';

export const exportEventRegistrationsCsv = async (
  event: EventItem,
  registrations: RegistrationRecord[],
  paymentIntents: PaymentIntentRecord[]
): Promise<{ ok: true; uri?: string } | { ok: false; reason: string }> => {
  if (!registrations.length) {
    return { ok: false, reason: 'Nessun iscritto da esportare.' };
  }

  const header = [
    'Evento',
    'Nome',
    'Email',
    'Telefono',
    'Citta',
    'DataNascita',
    'PartecipantiGruppo',
    'NumeroAssegnato',
    'Codice',
    'StatoIscrizione',
    'StatoPagamento',
    'Importo',
    'Commissione3Percento',
    'MetodoPagamento',
    'RiferimentoPagamento',
    'PaymentIntentId',
    'PaymentIntentStatus',
    'ScadenzaSessionePagamento',
    'MotivoErrorePagamento',
    'DataIscrizione',
    'DataUltimoAggiornamento',
  ];

  const paymentIntentById = new Map(paymentIntents.map((entry) => [entry.id, entry]));

  const rows = registrations.map((entry) => {
    const intent = entry.paymentIntentId ? paymentIntentById.get(entry.paymentIntentId) : undefined;
    return [
      event.name,
      entry.fullName,
      entry.email,
      entry.phone ?? '',
      entry.city ?? '',
      entry.birthDate ?? '',
      entry.groupParticipantsCount ?? 1,
      entry.assignedNumber ?? '',
      entry.registrationCode,
      entry.registrationStatus,
      entry.paymentStatus,
      entry.paymentAmount,
      entry.commissionAmount,
      entry.paymentMethod ?? '',
      entry.paymentReference ?? '',
      entry.paymentIntentId ?? '',
      intent?.status ?? '',
      entry.paymentSessionExpiresAt ?? '',
      entry.paymentFailedReason ?? intent?.failureReason ?? '',
      entry.createdAt,
      entry.updatedAt,
    ];
  });

  const csv = buildCsv(header, rows);
  const fileName = `iscritti_${event.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${Date.now()}.csv`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
      return { ok: false, reason: 'Download CSV non disponibile nel browser.' };
    }
  }

  const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;

  if (!fileUri) {
    return { ok: false, reason: 'Directory file non disponibile.' };
  }

  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (sharingAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Condividi elenco iscritti',
    });
    return { ok: true };
  }

  return { ok: true, uri: fileUri };
};
