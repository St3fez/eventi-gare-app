import React from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { styles } from '../styles';

type SectionCardProps = {
  title: string;
  children: React.ReactNode;
};

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: TextFieldProps) {
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

type FreeEventBannerProps = {
  text: string;
};

export function FreeEventBanner({ text }: FreeEventBannerProps) {
  return (
    <View style={styles.bannerWrap}>
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
