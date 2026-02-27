import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';

import { MetricChip, SectionCard, SwitchRow, TextField } from '../components/Common';
import {
  ADMIN_CONTACT_EMAIL,
  COMMISSION_RATE,
  MAX_IMAGE_UPLOAD_BYTES,
  ORGANIZER_TEST_MODE,
  SPONSOR_MODULE_ACTIVATION_EUR,
} from '../constants';
import { AppLanguage, Translator } from '../i18n';
import { organizerCanUsePaidSection, verificationStatusLabel } from '../services/fraud';
import { styles } from '../styles';
import {
  EventItem,
  OrganizerComplianceAttachment,
  OrganizerRole,
  OrganizerProfile,
  PaymentIntentRecord,
  RegistrationRecord,
  SponsorSlot,
} from '../types';
import {
  cleanText,
  estimateDataUrlBytes,
  formatDate,
  formatEventSchedule,
  parseEuro,
  toMoney,
} from '../utils/format';

type Props = {
  organizer: OrganizerProfile;
  events: EventItem[];
  registrations: RegistrationRecord[];
  paymentIntents: PaymentIntentRecord[];
  sponsorSlots: SponsorSlot[];
  onBack: () => void;
  onNewEvent: () => void;
  onEditEvent: (eventId: string) => void;
  onToggleEvent: (eventId: string) => Promise<void>;
  onToggleEventRegistrations: (eventId: string) => Promise<void>;
  onCloseEvent: (eventId: string) => Promise<void>;
  onReopenEvent: (eventId: string) => Promise<void>;
  onExportEvent: (eventId: string) => Promise<void>;
  onExportEventPdf: (eventId: string) => Promise<void>;
  onConfirmCashPayment: (registrationId: string) => Promise<void>;
  getEventPublicUrl: (event: EventItem) => string | null;
  onUpdateCompliance: (payload: {
    organizerId: string;
    organizationName: string;
    organizationRole: OrganizerRole;
    organizationRoleLabel?: string;
    legalRepresentative: string;
    officialPhone: string;
    fiscalData: string;
    bankAccount: string;
    identityDocumentUrl: string;
    organizationDocumentUrl: string;
    paymentAuthorizationDocumentUrl: string;
    adminContactMessage?: string;
  }) => Promise<void>;
  onSendComplianceEmail: (payload: {
    organizerId: string;
    organizationName: string;
    organizationRole: OrganizerRole;
    organizationRoleLabel?: string;
    legalRepresentative: string;
    officialPhone: string;
    fiscalData: string;
    bankAccount: string;
    adminContactMessage: string;
    attachments: OrganizerComplianceAttachment[];
  }) => Promise<void>;
  onRequestPaidUnlock: (organizerId: string) => Promise<void>;
  onStartStripeConnect: (organizerId: string) => Promise<void>;
  onSyncStripeConnect: (organizerId: string) => Promise<void>;
  onActivateSponsorModule: (organizerId: string) => Promise<void>;
  onCreateSponsorCheckout: (payload: {
    eventId: string;
    sponsorName: string;
    sponsorNameIt?: string;
    sponsorNameEn?: string;
    sponsorUrl?: string;
    sponsorLogoUrl?: string;
    sponsorEmail?: string;
    packageDays: number;
    amount: number;
  }) => Promise<void>;
  t: Translator;
  language: AppLanguage;
};

type QrCodeHandle = {
  toDataURL: (callback: (base64: string) => void) => void;
};

export function OrganizerDashboardScreen({
  organizer,
  events,
  registrations,
  paymentIntents,
  sponsorSlots,
  onBack,
  onNewEvent,
  onEditEvent,
  onToggleEvent,
  onToggleEventRegistrations,
  onCloseEvent,
  onReopenEvent,
  onExportEvent,
  onExportEventPdf,
  onConfirmCashPayment,
  getEventPublicUrl,
  onUpdateCompliance,
  onSendComplianceEmail,
  onRequestPaidUnlock,
  onStartStripeConnect,
  onSyncStripeConnect,
  onActivateSponsorModule,
  onCreateSponsorCheckout,
  t,
  language,
}: Props) {
  const maxImageKb = Math.round(MAX_IMAGE_UPLOAD_BYTES / 1024);
  const { width } = useWindowDimensions();
  const isDesktopLayout = width >= 1180;
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(events[0]?.id);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorNameIt, setSponsorNameIt] = useState('');
  const [sponsorNameEn, setSponsorNameEn] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState('');
  const [sponsorLogoFileName, setSponsorLogoFileName] = useState('');
  const [sponsorDays, setSponsorDays] = useState('1');
  const [sponsorAmount, setSponsorAmount] = useState('');
  const [organizationName, setOrganizationName] = useState(organizer.organizationName ?? '');
  const [organizationRole, setOrganizationRole] = useState<OrganizerRole>(
    organizer.organizationRole ?? 'altro'
  );
  const [organizationRoleLabel, setOrganizationRoleLabel] = useState(
    organizer.organizationRoleLabel ?? ''
  );
  const [legalRepresentative, setLegalRepresentative] = useState(
    organizer.legalRepresentative ?? ''
  );
  const [officialPhone, setOfficialPhone] = useState(organizer.officialPhone ?? '');
  const [fiscalData, setFiscalData] = useState(organizer.fiscalData ?? '');
  const [bankAccount, setBankAccount] = useState(organizer.bankAccount ?? '');
  const [identityDocumentUrl, setIdentityDocumentUrl] = useState(
    organizer.complianceDocuments.identityDocumentUrl ?? ''
  );
  const [organizationDocumentUrl, setOrganizationDocumentUrl] = useState(
    organizer.complianceDocuments.organizationDocumentUrl ?? ''
  );
  const [paymentAuthorizationDocumentUrl, setPaymentAuthorizationDocumentUrl] = useState(
    organizer.complianceDocuments.paymentAuthorizationDocumentUrl ?? ''
  );
  const [adminContactMessage, setAdminContactMessage] = useState(
    organizer.complianceDocuments.adminContactMessage ?? ''
  );
  const [identityAttachment, setIdentityAttachment] = useState<OrganizerComplianceAttachment | null>(
    null
  );
  const [organizationAttachment, setOrganizationAttachment] = useState<OrganizerComplianceAttachment | null>(
    null
  );
  const [paymentAttachment, setPaymentAttachment] = useState<OrganizerComplianceAttachment | null>(
    null
  );
  const [registrationQuery, setRegistrationQuery] = useState('');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<
    'all' | 'pending_payment' | 'pending_cash' | 'paid' | 'payment_failed' | 'cancelled' | 'refunded'
  >('all');
  const [simpleListView, setSimpleListView] = useState(true);
  const qrRef = useRef<QrCodeHandle | null>(null);

  useEffect(() => {
    if (!events.length) {
      setSelectedEventId(undefined);
      return;
    }
    if (!selectedEventId || !events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    setOrganizationName(organizer.organizationName ?? '');
    setOrganizationRole(organizer.organizationRole ?? 'altro');
    setOrganizationRoleLabel(organizer.organizationRoleLabel ?? '');
    setLegalRepresentative(organizer.legalRepresentative ?? '');
    setOfficialPhone(organizer.officialPhone ?? '');
    setFiscalData(organizer.fiscalData ?? '');
    setBankAccount(organizer.bankAccount ?? '');
    setIdentityDocumentUrl(organizer.complianceDocuments.identityDocumentUrl ?? '');
    setOrganizationDocumentUrl(organizer.complianceDocuments.organizationDocumentUrl ?? '');
    setPaymentAuthorizationDocumentUrl(
      organizer.complianceDocuments.paymentAuthorizationDocumentUrl ?? ''
    );
    setAdminContactMessage(organizer.complianceDocuments.adminContactMessage ?? '');
    setIdentityAttachment(null);
    setOrganizationAttachment(null);
    setPaymentAttachment(null);
    setSponsorLogoFileName('');
  }, [organizer]);

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedEventPublicUrl = selectedEvent ? getEventPublicUrl(selectedEvent) : null;
  const selectedEventIsDefinitive = Boolean(
    selectedEvent &&
      selectedEvent.active &&
      selectedEvent.visibility === 'public' &&
      !selectedEvent.closedAt
  );

  const eventRegistrations = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    const query = cleanText(registrationQuery).toLowerCase();
    return registrations
      .filter((entry) => entry.eventId === selectedEvent.id)
      .filter((entry) =>
        registrationStatusFilter === 'all'
          ? true
          : entry.registrationStatus === registrationStatusFilter
      )
      .filter((entry) => {
        if (!query) {
          return true;
        }
        return (
          entry.fullName.toLowerCase().includes(query) ||
          entry.email.toLowerCase().includes(query) ||
          entry.registrationCode.toLowerCase().includes(query)
        );
      })
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [registrationQuery, registrationStatusFilter, registrations, selectedEvent]);

  const sponsorSlotsForEvent = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }
    return sponsorSlots
      .filter((slot) => slot.eventId === selectedEvent.id)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [selectedEvent, sponsorSlots]);

  const allEventIds = new Set(events.map((entry) => entry.id));
  const organizerRegistrations = registrations.filter((entry) => allEventIds.has(entry.eventId));
  const organizerParticipantCount = organizerRegistrations.reduce(
    (sum, entry) => sum + Math.max(1, entry.groupParticipantsCount || 1),
    0
  );
  const grossRevenue = organizerRegistrations.reduce((sum, entry) => sum + entry.paymentAmount, 0);
  const totalCommission = organizerRegistrations.reduce((sum, entry) => sum + entry.commissionAmount, 0);
  const canCreatePaidEvents = organizerCanUsePaidSection(organizer, ORGANIZER_TEST_MODE);
  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const roundMoney = (value: number): number => Number.parseFloat(value.toFixed(2));

  const getRegistrationSplit = (entry: RegistrationRecord) => {
    const event = eventById.get(entry.eventId);
    if (!event) {
      return null;
    }
    const participants = Math.max(1, entry.groupParticipantsCount || 1);
    const baseTotal = roundMoney(event.baseFeeAmount * participants);
    const commissionTotal = roundMoney(entry.commissionAmount ?? baseTotal * COMMISSION_RATE);
    const providerFeeTotal = roundMoney(
      event.providerFeeRate * baseTotal + event.providerFeeFixed * participants
    );
    const organizerNetTotal =
      event.feePolicy === 'participant_pays_fees'
        ? baseTotal
        : roundMoney(Math.max(0, baseTotal - commissionTotal - providerFeeTotal));

    return {
      baseTotal,
      commissionTotal,
      providerFeeTotal,
      organizerNetTotal,
    };
  };

  const totalProviderFees = organizerRegistrations.reduce((sum, entry) => {
    const split = getRegistrationSplit(entry);
    return sum + (split?.providerFeeTotal ?? 0);
  }, 0);

  const totalOrganizerNet = organizerRegistrations.reduce((sum, entry) => {
    const split = getRegistrationSplit(entry);
    return sum + (split?.organizerNetTotal ?? 0);
  }, 0);

  const stripeConnectStatus =
    organizer.stripeConnectChargesEnabled && organizer.stripeConnectPayoutsEnabled
      ? 'ready'
      : organizer.stripeConnectAccountId
        ? 'pending'
        : 'not_connected';
  const stripeConnectRequirements = organizer.stripeConnectRequirements ?? [];

  const paymentIntentMap = useMemo(
    () => new Map(paymentIntents.map((intent) => [intent.id, intent])),
    [paymentIntents]
  );

  const sponsorStatusLabel = (status: SponsorSlot['status']) => {
    switch (status) {
      case 'pending_payment':
        return t('sponsor_status_pending_payment');
      case 'active':
        return t('sponsor_status_active');
      case 'expired':
        return t('sponsor_status_expired');
      case 'cancelled':
        return t('sponsor_status_cancelled');
      case 'payment_failed':
        return t('sponsor_status_payment_failed');
      case 'refunded':
        return t('sponsor_status_refunded');
      default:
        return status;
    }
  };

  const registrationStatusLabel = (status: RegistrationRecord['registrationStatus']) => {
    if (status === 'pending_cash') {
      return t('registration_status_pending_cash');
    }
    return status;
  };

  const normalizeExternalUrl = (input: string): string => {
    const value = cleanText(input);
    if (!value) {
      return '';
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return `https://${value}`;
  };

  const openExternalUrl = async (url: string) => {
    const normalized = normalizeExternalUrl(url);
    if (!normalized) {
      return;
    }
    const canOpen = await Linking.canOpenURL(normalized);
    if (!canOpen) {
      Alert.alert(t('sponsor_activity_open_fail_title'), t('sponsor_activity_open_fail_message'));
      return;
    }
    await Linking.openURL(normalized);
  };

  const submitSponsorCheckout = () => {
    if (!organizer.sponsorModuleEnabled) {
      Alert.alert(
        t('sponsor_module_not_active_title'),
        t('sponsor_module_not_active_message', {
          amount: toMoney(SPONSOR_MODULE_ACTIVATION_EUR),
        })
      );
      return;
    }

    if (!selectedEvent) {
      Alert.alert(t('missing_data_title'), t('select_event_for_list'));
      return;
    }

    if (!cleanText(sponsorName)) {
      Alert.alert(t('missing_data_title'), t('sponsor_name_required'));
      return;
    }

    const parsedDays = Number.parseInt(sponsorDays, 10);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      Alert.alert(t('missing_data_title'), t('sponsor_days_invalid'));
      return;
    }

    const parsedAmount = parseEuro(sponsorAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert(t('missing_data_title'), t('sponsor_amount_invalid'));
      return;
    }

    void onCreateSponsorCheckout({
      eventId: selectedEvent.id,
      sponsorName,
      sponsorNameIt,
      sponsorNameEn,
      sponsorUrl: normalizeExternalUrl(sponsorUrl),
      sponsorLogoUrl,
      sponsorEmail,
      packageDays: parsedDays,
      amount: parsedAmount,
    }).then(() => {
      setSponsorName('');
      setSponsorNameIt('');
      setSponsorNameEn('');
      setSponsorEmail('');
      setSponsorUrl('');
      setSponsorLogoUrl('');
      setSponsorLogoFileName('');
      setSponsorDays('1');
      setSponsorAmount('');
    });
  };

  const saveComplianceData = () => {
    void onUpdateCompliance({
      organizerId: organizer.id,
      organizationName,
      organizationRole,
      organizationRoleLabel,
      legalRepresentative,
      officialPhone,
      fiscalData,
      bankAccount,
      identityDocumentUrl,
      organizationDocumentUrl,
      paymentAuthorizationDocumentUrl,
      adminContactMessage,
    });
  };

  const pickAttachment = async (
    kind: OrganizerComplianceAttachment['kind'],
    setValue: (value: OrganizerComplianceAttachment | null) => void,
    setName: (value: string) => void
  ) => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    if (!file.uri || !file.name) {
      return;
    }

    setValue({
      kind,
      uri: file.uri,
      fileName: file.name,
      mimeType: file.mimeType ?? 'application/octet-stream',
    });
    setName(file.name);
  };

  const assetToDataUrl = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('file_read_error'));
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
          }
          reject(new Error('file_read_error'));
        };
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    }

    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = cleanText(asset.mimeType ?? '') || 'image/png';
    return `data:${mime};base64,${base64}`;
  };

  const pickSponsorLogo = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*'],
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const file = result.assets[0];
    if (!file.uri || !file.name) {
      return;
    }

    try {
      const dataUrl = await assetToDataUrl(file);
      if (estimateDataUrlBytes(dataUrl) > MAX_IMAGE_UPLOAD_BYTES) {
        Alert.alert(
          t('image_upload_too_large_title'),
          t('image_upload_too_large_message', { maxKb: maxImageKb })
        );
        return;
      }
      setSponsorLogoUrl(dataUrl);
      setSponsorLogoFileName(file.name);
    } catch {
      Alert.alert(t('sponsor_logo_upload_error_title'), t('sponsor_logo_upload_error_message'));
    }
  };

  const sendComplianceEmail = () => {
    const attachments = [identityAttachment, organizationAttachment, paymentAttachment].filter(
      (entry): entry is OrganizerComplianceAttachment => Boolean(entry)
    );

    void onSendComplianceEmail({
      organizerId: organizer.id,
      organizationName,
      organizationRole,
      organizationRoleLabel,
      legalRepresentative,
      officialPhone,
      fiscalData,
      bankAccount,
      adminContactMessage,
      attachments,
    });
  };

  const copyEventUrl = async () => {
    if (!selectedEventPublicUrl) {
      Alert.alert(t('missing_data_title'), t('event_public_url_missing'));
      return;
    }
    await Clipboard.setStringAsync(selectedEventPublicUrl);
    Alert.alert(t('event_link_copied_title'), t('event_link_copied_message'));
  };

  const shareEventUrl = async () => {
    if (!selectedEventPublicUrl) {
      Alert.alert(t('missing_data_title'), t('event_public_url_missing'));
      return;
    }
    await Share.share({
      message: selectedEventPublicUrl,
      url: selectedEventPublicUrl,
    });
  };

  const downloadQrCode = async () => {
    if (!selectedEvent || !selectedEventPublicUrl) {
      Alert.alert(t('missing_data_title'), t('event_public_url_missing'));
      return;
    }
    if (!qrRef.current) {
      Alert.alert(t('missing_data_title'), t('event_qr_not_ready'));
      return;
    }

    qrRef.current.toDataURL(async (base64: string) => {
      const safeName = selectedEvent.name.replace(/[^a-zA-Z0-9]+/g, '_');
      const fileName = `qrcode_${safeName}_${Date.now()}.png`;

      if (Platform.OS === 'web') {
        const anchor = document.createElement('a');
        anchor.href = `data:image/png;base64,${base64}`;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? ''}${fileName}`;
      if (!fileUri) {
        Alert.alert(t('export_not_available_title'), t('event_qr_not_ready'));
        return;
      }

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: t('event_qr_download'),
        });
      } else {
        Alert.alert(t('file_generated_title'), t('file_generated_message', { uri: fileUri }));
      }
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.screenSplit, isDesktopLayout ? styles.screenSplitDesktop : undefined]}>
        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnMain : undefined]}>
          <SectionCard title={t('organizer_dashboard')} delayMs={0}>
            <Text style={styles.cardParagraph}>{t('account_label', { email: organizer.email })}</Text>
            <Text style={styles.cardParagraph}>
              {t('antifraud_status', {
                status: verificationStatusLabel(organizer.verificationStatus, language),
                payout: organizer.payoutEnabled ? t('payout_enabled') : t('payout_blocked'),
              })}
            </Text>
            <Text style={styles.helperText}>{t('risk_score', { score: organizer.riskScore })}</Text>
            {organizer.riskFlags.length > 0 ? (
              <Text style={styles.helperText}>
                {t('risk_flags', { flags: organizer.riskFlags.join(' | ') })}
              </Text>
            ) : null}
            <Text style={styles.helperText}>
              {t('paid_unlock_status', {
                status: organizer.paidFeatureUnlocked
                  ? t('paid_unlock_enabled')
                  : t('paid_unlock_waiting'),
              })}
            </Text>
            {organizer.paidFeatureUnlockRequestedAt ? (
              <Text style={styles.helperText}>
                {t('paid_unlock_requested_at', {
                  date: formatDate(organizer.paidFeatureUnlockRequestedAt.slice(0, 10)),
                })}
              </Text>
            ) : null}
            {!canCreatePaidEvents ? (
              <Text style={styles.helperText}>{t('paid_disabled')}</Text>
            ) : null}

            <View style={styles.blockSpacing}>
              <Text style={styles.fieldLabel}>{t('stripe_connect_title')}</Text>
              <Text style={styles.helperText}>
                {t('stripe_connect_status_line', {
                  status:
                    stripeConnectStatus === 'ready'
                      ? t('stripe_connect_status_ready')
                      : stripeConnectStatus === 'pending'
                        ? t('stripe_connect_status_pending')
                        : t('stripe_connect_status_not_connected'),
                })}
              </Text>
              {stripeConnectRequirements.length > 0 ? (
                <Text style={styles.helperText}>
                  {t('stripe_connect_requirements', {
                    count: stripeConnectRequirements.length,
                  })}
                </Text>
              ) : null}
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  void onStartStripeConnect(organizer.id);
                }}
              >
                <Text style={styles.primaryButtonText}>{t('stripe_connect_start')}</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  void onSyncStripeConnect(organizer.id);
                }}
              >
                <Text style={styles.secondaryButtonText}>{t('stripe_connect_refresh')}</Text>
              </Pressable>
            </View>

            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('created_events')} value={String(events.length)} />
              <MetricChip label={t('registered_users')} value={String(organizerParticipantCount)} />
            </View>
            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('gross_revenue')} value={toMoney(grossRevenue)} />
              <MetricChip label={t('commissions_3')} value={toMoney(totalCommission)} />
              <MetricChip label={t('provider_fees')} value={toMoney(totalProviderFees)} />
            </View>
            <View style={styles.inlineMetricRow}>
              <MetricChip label={t('organizer_net_total')} value={toMoney(totalOrganizerNet)} />
            </View>

            <Pressable style={styles.primaryButton} onPress={onNewEvent}>
              <Text style={styles.primaryButtonText}>{t('create_new_event')}</Text>
            </Pressable>
            {!organizer.paidFeatureUnlocked ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  void onRequestPaidUnlock(organizer.id);
                }}
              >
                <Text style={styles.secondaryButtonText}>{t('request_paid_unlock')}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>{t('back_home')}</Text>
            </Pressable>
          </SectionCard>

          <SectionCard title={t('your_events')} delayMs={90}>
            {events.length === 0 ? (
              <Text style={styles.cardParagraph}>{t('no_events')}</Text>
            ) : (
              events
                .sort((first, second) => first.date.localeCompare(second.date))
                .map((event) => {
                  const eventCount = registrations
                    .filter((entry) => entry.eventId === event.id)
                    .reduce((sum, entry) => sum + Math.max(1, entry.groupParticipantsCount || 1), 0);
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.listCard,
                        selectedEventId === event.id ? styles.listCardSelected : undefined,
                      ]}
                    >
                      <Pressable onPress={() => setSelectedEventId(event.id)}>
                        <Text style={styles.listTitle}>{event.name}</Text>
                        <Text style={styles.listSubText}>
                          {event.location} | {formatEventSchedule(event)} |{' '}
                          {event.isFree
                            ? t('event_free')
                            : t('event_fee', { fee: toMoney(event.feeAmount) })}
                        </Text>
                        <Text style={styles.listSubText}>
                          {t('registration_window_line', {
                            from: formatDate(event.registrationOpenDate),
                            to: formatDate(event.registrationCloseDate),
                          })}
                        </Text>
                        <Text style={styles.listSubText}>
                          {t('event_visibility_line', {
                            value:
                              event.visibility === 'public'
                                ? t('event_visibility_public_short')
                                : t('event_visibility_hidden_short'),
                          })}
                        </Text>
                        {!event.isFree ? (
                          <Text style={styles.listSubText}>
                            {t('event_fee_plan_line', {
                              base: toMoney(event.baseFeeAmount),
                              participant: toMoney(event.feeAmount),
                              net: toMoney(event.organizerNetAmount),
                            })}
                          </Text>
                        ) : null}
                        <Text style={styles.listSubText}>
                          {t('subscribers_count', { count: eventCount })}
                        </Text>
                        <Text style={styles.listSubText}>
                          {event.active ? t('event_status_active') : t('event_status_inactive')}
                        </Text>
                        <Text style={styles.listSubText}>
                          {event.registrationsOpen
                            ? t('event_registrations_open')
                            : t('event_registrations_closed')}
                        </Text>
                        <Text style={styles.listSubText}>
                          {t('event_season_version', { value: event.seasonVersion || 1 })}
                        </Text>
                        {event.closedAt ? (
                          <Text style={styles.listSubText}>
                            {t('event_closed_at', { value: formatDate(event.closedAt.slice(0, 10)) })}
                          </Text>
                        ) : null}
                      </Pressable>

                      <View style={styles.inlineActionRow}>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => onEditEvent(event.id)}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('edit_event')}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onToggleEventRegistrations(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>
                            {event.registrationsOpen
                              ? t('close_registrations')
                              : t('open_registrations')}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onToggleEvent(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>
                            {event.active ? t('deactivate') : t('activate')}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onCloseEvent(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('close_event')}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onReopenEvent(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('reopen_event')}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onExportEvent(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('export_csv')}</Text>
                        </Pressable>
                        <Pressable
                          style={styles.inlineActionButton}
                          onPress={() => {
                            void onExportEventPdf(event.id);
                          }}
                        >
                          <Text style={styles.inlineActionButtonText}>{t('export_pdf')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
            )}
          </SectionCard>
        </View>

        <View style={[styles.screenSplitColumn, isDesktopLayout ? styles.screenSplitColumnSide : undefined]}>
          <SectionCard title={t('event_public_tools')} delayMs={130}>
            {!selectedEvent ? (
              <Text style={styles.helperText}>{t('select_event_for_list')}</Text>
            ) : !selectedEventIsDefinitive ? (
              <Text style={styles.helperText}>{t('event_public_tools_not_definitive')}</Text>
            ) : (
              <>
                <Text style={styles.helperText}>
                  {t('event_public_tools_intro')}
                </Text>
                <Text style={styles.listSubText}>
                  {selectedEventPublicUrl ?? t('event_public_url_missing')}
                </Text>
                {selectedEventPublicUrl ? (
                  <View style={styles.registrationCard}>
                    <QRCode
                      value={selectedEventPublicUrl}
                      size={180}
                      getRef={(ref) => {
                        qrRef.current = ref as QrCodeHandle | null;
                      }}
                    />
                  </View>
                ) : null}
                <Pressable style={styles.secondaryButton} onPress={() => void copyEventUrl()}>
                  <Text style={styles.secondaryButtonText}>{t('copy_event_link')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void shareEventUrl()}>
                  <Text style={styles.secondaryButtonText}>{t('share_event_link')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void downloadQrCode()}>
                  <Text style={styles.secondaryButtonText}>{t('event_qr_download')}</Text>
                </Pressable>
              </>
            )}
          </SectionCard>

          <SectionCard title={t('organizer_compliance_section')} delayMs={150}>
            <Text style={styles.cardParagraph}>{t('organizer_compliance_intro')}</Text>
            <TextField
              label={t('organization_name_label')}
              value={organizationName}
              onChangeText={setOrganizationName}
            />
            <Text style={styles.fieldLabel}>{t('organization_role_label')}</Text>
            <View style={styles.methodRow}>
              <Pressable
                style={[
                  styles.methodChip,
                  organizationRole === 'presidente_fondazione' ? styles.methodChipActive : undefined,
                ]}
                onPress={() => setOrganizationRole('presidente_fondazione')}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    organizationRole === 'presidente_fondazione'
                      ? styles.methodChipTextActive
                      : undefined,
                  ]}
                >
                  {t('organization_role_president')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.methodChip,
                  organizationRole === 'segretario_associazione'
                    ? styles.methodChipActive
                    : undefined,
                ]}
                onPress={() => setOrganizationRole('segretario_associazione')}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    organizationRole === 'segretario_associazione'
                      ? styles.methodChipTextActive
                      : undefined,
                  ]}
                >
                  {t('organization_role_secretary')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.methodChip, organizationRole === 'altro' ? styles.methodChipActive : undefined]}
                onPress={() => setOrganizationRole('altro')}
              >
                <Text
                  style={[
                    styles.methodChipText,
                    organizationRole === 'altro' ? styles.methodChipTextActive : undefined,
                  ]}
                >
                  {t('organization_role_other')}
                </Text>
              </Pressable>
            </View>
            {organizationRole === 'altro' ? (
              <TextField
                label={t('organization_role_other_label')}
                value={organizationRoleLabel}
                onChangeText={setOrganizationRoleLabel}
              />
            ) : null}
            <TextField
              label={t('legal_representative_label')}
              value={legalRepresentative}
              onChangeText={setLegalRepresentative}
            />
            <TextField
              label={t('official_phone_label')}
              value={officialPhone}
              onChangeText={setOfficialPhone}
              keyboardType='phone-pad'
            />
            <TextField
              label={t('fiscal_optional')}
              value={fiscalData}
              onChangeText={setFiscalData}
            />
            <TextField
              label={t('bank_label')}
              value={bankAccount}
              onChangeText={setBankAccount}
            />
            <Text style={styles.fieldLabel}>{t('identity_document_name_label')}</Text>
            <Text style={styles.helperText}>
              {identityDocumentUrl || t('document_not_selected')}
            </Text>
            <Text style={styles.fieldLabel}>{t('organization_document_name_label')}</Text>
            <Text style={styles.helperText}>
              {organizationDocumentUrl || t('document_not_selected')}
            </Text>
            <Text style={styles.fieldLabel}>{t('payment_authorization_document_name_label')}</Text>
            <Text style={styles.helperText}>
              {paymentAuthorizationDocumentUrl || t('document_not_selected')}
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void pickAttachment('identity_document', setIdentityAttachment, setIdentityDocumentUrl);
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t('pick_identity_document')}
              </Text>
            </Pressable>
            {identityAttachment ? (
              <Text style={styles.helperText}>{identityAttachment.fileName}</Text>
            ) : null}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void pickAttachment(
                  'organization_document',
                  setOrganizationAttachment,
                  setOrganizationDocumentUrl
                );
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t('pick_organization_document')}
              </Text>
            </Pressable>
            {organizationAttachment ? (
              <Text style={styles.helperText}>{organizationAttachment.fileName}</Text>
            ) : null}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void pickAttachment(
                  'payment_authorization_document',
                  setPaymentAttachment,
                  setPaymentAuthorizationDocumentUrl
                );
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {t('pick_payment_authorization_document')}
              </Text>
            </Pressable>
            {paymentAttachment ? (
              <Text style={styles.helperText}>{paymentAttachment.fileName}</Text>
            ) : null}
            <TextField
              label={t('admin_contact_message_label')}
              value={adminContactMessage}
              onChangeText={setAdminContactMessage}
              multiline
            />
            <Pressable style={styles.primaryButton} onPress={saveComplianceData}>
              <Text style={styles.primaryButtonText}>{t('save_organizer_documents')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={sendComplianceEmail}>
              <Text style={styles.secondaryButtonText}>
                {t('send_documents_admin', {
                  email: ADMIN_CONTACT_EMAIL,
                })}
              </Text>
            </Pressable>
          </SectionCard>

          <SectionCard title={t('sponsor_paid_section')} delayMs={180}>
            <Text style={styles.cardParagraph}>{t('sponsor_paid_intro')}</Text>
            {!organizer.sponsorModuleEnabled ? (
              <>
                <Text style={styles.helperText}>
                  {t('sponsor_module_activation_intro', {
                    amount: toMoney(SPONSOR_MODULE_ACTIVATION_EUR),
                  })}
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    void onActivateSponsorModule(organizer.id);
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    {t('sponsor_module_activate_button', {
                      amount: toMoney(SPONSOR_MODULE_ACTIVATION_EUR),
                    })}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {organizer.sponsorModuleActivatedAt ? (
                  <Text style={styles.helperText}>
                    {t('sponsor_module_active_since', {
                      date: formatDate(organizer.sponsorModuleActivatedAt.slice(0, 10)),
                    })}
                  </Text>
                ) : null}

                {selectedEvent ? (
                  <Text style={styles.helperText}>
                    {t('sponsor_selected_event', { event: selectedEvent.name })}
                  </Text>
                ) : (
                  <Text style={styles.helperText}>{t('select_event_for_list')}</Text>
                )}

                <TextField
                  label={t('sponsor_name_required')}
                  value={sponsorName}
                  onChangeText={setSponsorName}
                />
                <TextField
                  label={t('sponsor_name_it_optional')}
                  value={sponsorNameIt}
                  onChangeText={setSponsorNameIt}
                />
                <TextField
                  label={t('sponsor_name_en_optional')}
                  value={sponsorNameEn}
                  onChangeText={setSponsorNameEn}
                />
                <TextField
                  label={t('sponsor_days_label')}
                  value={sponsorDays}
                  onChangeText={setSponsorDays}
                  keyboardType='decimal-pad'
                />
                <TextField
                  label={t('sponsor_amount_label')}
                  value={sponsorAmount}
                  onChangeText={setSponsorAmount}
                  keyboardType='decimal-pad'
                />
                <TextField
                  label={t('sponsor_email_optional')}
                  value={sponsorEmail}
                  onChangeText={setSponsorEmail}
                  keyboardType='email-address'
                />
                <TextField
                  label={t('sponsor_url_optional')}
                  value={sponsorUrl}
                  onChangeText={setSponsorUrl}
                  placeholder='https://...'
                />
                <Text style={styles.fieldLabel}>{t('sponsor_logo_optional')}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => void pickSponsorLogo()}>
                  <Text style={styles.secondaryButtonText}>{t('sponsor_logo_pick_button')}</Text>
                </Pressable>
                <Text style={styles.helperText}>
                  {sponsorLogoFileName || t('document_not_selected')}
                </Text>
                {sponsorLogoUrl ? (
                  <Image source={{ uri: sponsorLogoUrl }} style={styles.sponsorLogoPreview} />
                ) : null}

                <Pressable style={styles.primaryButton} onPress={submitSponsorCheckout}>
                  <Text style={styles.primaryButtonText}>{t('sponsor_generate_checkout')}</Text>
                </Pressable>
              </>
            )}

            <Text style={styles.fieldLabel}>{t('sponsor_slots_for_event')}</Text>
            {sponsorSlotsForEvent.length === 0 ? (
              <Text style={styles.helperText}>{t('sponsor_no_slots')}</Text>
            ) : (
              sponsorSlotsForEvent.map((slot) => (
                <View key={slot.id} style={styles.registrationCard}>
                  <Text style={styles.listTitle}>
                    {language === 'it' ? slot.sponsorNameIt : slot.sponsorNameEn}
                  </Text>
                  {slot.sponsorLogoUrl ? (
                    <Image source={{ uri: slot.sponsorLogoUrl }} style={styles.sponsorLogoPreview} />
                  ) : null}
                  <Text style={styles.listSubText}>
                    {toMoney(slot.amount)} | {slot.packageDays}d
                  </Text>
                  <Text style={styles.listSubText}>
                    {t('sponsor_slot_status', {
                      status: sponsorStatusLabel(slot.status),
                      active: slot.active ? 'true' : 'false',
                    })}
                  </Text>
                  <Text style={styles.listSubText}>
                    {t('sponsor_slot_period', {
                      from: formatDate(slot.startsAt.slice(0, 10)),
                      to: formatDate(slot.endsAt.slice(0, 10)),
                    })}
                  </Text>
                  {slot.sponsorUrl ? (
                    <Pressable
                      style={styles.inlineActionButton}
                      onPress={() => {
                        void openExternalUrl(slot.sponsorUrl ?? '');
                      }}
                    >
                      <Text style={styles.inlineActionButtonText}>{t('sponsor_activity_open')}</Text>
                    </Pressable>
                  ) : null}
                  {slot.stripePaymentLinkUrl ? (
                    <Text style={styles.listSubText}>
                      {t('sponsor_slot_checkout_link', { url: slot.stripePaymentLinkUrl })}
                    </Text>
                  ) : null}
                  {slot.contractTerms.it ? (
                    <Text style={styles.helperText}>
                      {t('sponsor_slot_contract_it', { text: slot.contractTerms.it })}
                    </Text>
                  ) : null}
                  {slot.contractTerms.en ? (
                    <Text style={styles.helperText}>
                      {t('sponsor_slot_contract_en', { text: slot.contractTerms.en })}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </SectionCard>
        </View>
      </View>

      <SectionCard title={t('realtime_list')} delayMs={270}>
        {!selectedEvent ? (
          <Text style={styles.cardParagraph}>{t('select_event_for_list')}</Text>
        ) : (
          <>
            <TextField
              label={t('registration_filter_query')}
              value={registrationQuery}
              onChangeText={setRegistrationQuery}
              placeholder={t('registration_filter_query_placeholder')}
            />
            <Text style={styles.fieldLabel}>{t('registration_filter_status')}</Text>
            <View style={styles.methodRow}>
              {[
                ['all', t('registration_filter_all')],
                ['pending_payment', 'pending_payment'],
                ['pending_cash', t('registration_status_pending_cash')],
                ['paid', 'paid'],
                ['payment_failed', 'payment_failed'],
                ['cancelled', 'cancelled'],
                ['refunded', 'refunded'],
              ].map(([status, label]) => (
                <Pressable
                  key={status}
                  style={[
                    styles.methodChip,
                    registrationStatusFilter === status ? styles.methodChipActive : undefined,
                  ]}
                  onPress={() =>
                    setRegistrationStatusFilter(
                      status as
                        | 'all'
                        | 'pending_payment'
                        | 'pending_cash'
                        | 'paid'
                        | 'payment_failed'
                        | 'cancelled'
                        | 'refunded'
                    )
                  }
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      registrationStatusFilter === status
                        ? styles.methodChipTextActive
                        : undefined,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <SwitchRow
              label={t('registration_simple_view')}
              value={simpleListView}
              onValueChange={setSimpleListView}
            />
            {eventRegistrations.length === 0 ? (
              <Text style={styles.cardParagraph}>
                {t('no_registrations_for_event', { event: selectedEvent.name })}
              </Text>
            ) : (
              eventRegistrations.map((entry) => {
                const intent = entry.paymentIntentId
                  ? paymentIntentMap.get(entry.paymentIntentId)
                  : undefined;
                const split = getRegistrationSplit(entry);
                const numberText =
                  typeof entry.assignedNumber === 'number'
                    ? t('number_suffix', { number: entry.assignedNumber })
                    : '';
                return (
                  <View key={entry.id} style={styles.registrationCard}>
                    <Text style={styles.listTitle}>{entry.fullName}</Text>
                    <Text style={styles.listSubText}>{entry.email}</Text>
                    {entry.groupParticipantsCount > 1 ? (
                      <Text style={styles.listSubText}>
                        {t('group_participants_line', { count: entry.groupParticipantsCount })}
                      </Text>
                    ) : null}
                    <Text style={styles.listSubText}>
                      {t('code_number_line', {
                        code: entry.registrationCode,
                        number: numberText,
                      })}
                    </Text>
                    <Text style={styles.listSubText}>
                      {t('registration_payment_state', {
                        reg: registrationStatusLabel(entry.registrationStatus),
                        pay: entry.paymentStatus,
                      })}
                    </Text>
                    {!simpleListView ? (
                      <>
                        <Text style={styles.listSubText}>
                          {t('amount_commission', {
                            amount: toMoney(entry.paymentAmount),
                            commission: toMoney(entry.commissionAmount),
                          })}
                        </Text>
                        {split ? (
                          <Text style={styles.listSubText}>
                            {t('registration_split_line', {
                              base: toMoney(split.baseTotal),
                              commission: toMoney(split.commissionTotal),
                              provider: toMoney(split.providerFeeTotal),
                              net: toMoney(split.organizerNetTotal),
                            })}
                          </Text>
                        ) : null}
                        {entry.paymentReference ? (
                          <Text style={styles.listSubText}>
                            {t('payment_reference', { reference: entry.paymentReference })}
                          </Text>
                        ) : null}
                        {intent ? (
                          <Text style={styles.listSubText}>
                            {t('payment_intent_line', { id: intent.id, status: intent.status })}
                          </Text>
                        ) : null}
                    {entry.paymentFailedReason ? (
                      <Text style={styles.listSubText}>
                        {t('payment_error_reason', { reason: entry.paymentFailedReason })}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {entry.registrationStatus === 'pending_cash' ? (
                  <Pressable
                    style={styles.inlineActionButton}
                    onPress={() => {
                      void onConfirmCashPayment(entry.id);
                    }}
                  >
                    <Text style={styles.inlineActionButtonText}>
                      {t('cash_payment_confirm_by_organizer')}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={styles.listSubText}>
                  {t('registration_date', { date: formatDate(entry.createdAt.slice(0, 10)) })}
                </Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </SectionCard>
    </ScrollView>
  );
}
