import type { Subscription } from 'expo-modules-core';

declare module 'expo-modules-core' {
  export type EventSubscription = Subscription;
}

export {};
