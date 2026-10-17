import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  useWindowDimensions,
} from 'react-native';

import { styles } from '../styles';

type SectionCardProps = {
  title: string;
  children: React.ReactNode;
  delayMs?: number;
};

export function SectionCard({ title, children, delayMs = 0 }: SectionCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delayMs, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  inputMode?: TextInputProps['inputMode'];
  returnKeyType?: TextInputProps['returnKeyType'];
  maxLength?: number;
  autoFocus?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  secureTextEntry = false,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  textContentType,
  inputMode,
  returnKeyType,
  maxLength,
  autoFocus = false,
}: TextFieldProps) {
  const resolvedAutoCapitalize =
    autoCapitalize ??
    (keyboardType === 'email-address' ? 'none' : multiline ? 'sentences' : 'words');
  const resolvedAutoCorrect =
    autoCorrect ??
    !['email-address', 'phone-pad', 'decimal-pad', 'number-pad'].includes(keyboardType);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor='#8AA8C0'
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={resolvedAutoCapitalize}
        autoCorrect={resolvedAutoCorrect}
        autoComplete={autoComplete}
        textContentType={textContentType}
        inputMode={inputMode}
        returnKeyType={returnKeyType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        importantForAutofill='yes'
        accessibilityLabel={label}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline ? styles.inputMultiline : undefined]}
      />
    </View>
  );
}

type SwitchRowProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  helper?: string;
};

export function SwitchRow({ label, value, onValueChange, helper }: SwitchRowProps) {
  return (
    <View style={styles.switchBlock}>
      <View style={styles.switchHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          thumbColor={value ? '#F1C65C' : '#D9E4EE'}
          trackColor={{ false: '#6E8BA2', true: '#3AA08A' }}
        />
      </View>
      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

type CheckboxRowProps = {
  value: boolean;
  onToggle: () => void;
  label: string;
};

export function CheckboxRow({ value, onToggle, label }: CheckboxRowProps) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onToggle}>
      <View style={[styles.checkbox, value ? styles.checkboxActive : undefined]}>
        {value ? <Text style={styles.checkboxMark}>X</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

type MetricChipProps = {
  label: string;
  value: string;
};

export function MetricChip({ label, value }: MetricChipProps) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

type StatusBadgeProps = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning';
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'success'
          ? styles.statusBadgeSuccess
          : tone === 'warning'
            ? styles.statusBadgeWarning
            : styles.statusBadgeNeutral,
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          tone === 'success'
            ? styles.statusBadgeTextSuccess
            : tone === 'warning'
              ? styles.statusBadgeTextWarning
              : styles.statusBadgeTextNeutral,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

type DisclosureSectionProps = {
  title: string;
  hint?: string;
  initiallyOpen?: boolean;
  children: React.ReactNode;
};

export function DisclosureSection({
  title,
  hint,
  initiallyOpen = false,
  children,
}: DisclosureSectionProps) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View style={styles.formSectionCard}>
      <Pressable
        style={styles.disclosureHeader}
        onPress={() => setOpen((current) => !current)}
        accessibilityRole='button'
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.disclosureHeaderText}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          {hint && !open ? <Text style={styles.helperText}>{hint}</Text> : null}
        </View>
        <Text style={styles.disclosureChevron}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segmentedItem, active ? styles.segmentedItemActive : undefined]}
            onPress={() => onChange(option.value)}
            accessibilityRole='button'
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.segmentedItemText, active ? styles.segmentedItemTextActive : undefined]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type LanguageToggleProps = {
  language: 'it' | 'en';
  onChange: (language: 'it' | 'en') => void;
};

export function LanguageToggle({ language, onChange }: LanguageToggleProps) {
  return (
    <View style={styles.languageSwitchWrap}>
      {(['it', 'en'] as const).map((code) => {
        const active = language === code;
        return (
          <Pressable
            key={code}
            style={[styles.languageChip, active ? styles.languageChipActive : undefined]}
            onPress={() => onChange(code)}
            accessibilityRole='button'
            accessibilityState={{ selected: active }}
            accessibilityLabel={code === 'it' ? 'Italiano' : 'English'}
          >
            <Text
              style={[styles.languageChipText, active ? styles.languageChipTextActive : undefined]}
            >
              {code.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FreeEventBannerProps = {
  text: string;
};

export function FreeEventBanner({ text }: FreeEventBannerProps) {
  const { width } = useWindowDimensions();
  const maxContentWidth = 1200;
  const horizontalMargins = 28;
  const computedWidth = Math.min(maxContentWidth, Math.max(0, width - horizontalMargins));

  return (
    <View style={[styles.bannerWrap, { width: computedWidth }]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

type FallbackProps = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

export function FallbackScreen({ message, actionLabel, onAction }: FallbackProps) {
  return (
    <View style={styles.fallbackContainer}>
      <Text style={styles.fallbackText}>{message}</Text>
      <Pressable style={styles.primaryButton} onPress={onAction}>
        <Text style={styles.primaryButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
