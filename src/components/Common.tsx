import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Switch,
  Text,
  TextInput,
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
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  secureTextEntry?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  secureTextEntry = false,
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
        secureTextEntry={secureTextEntry}
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
