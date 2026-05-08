import type { Pod } from './types';

export const ACTIVE_AMS = [
  'Sudha Goutami', 'Sakshi Mamgain', 'Hubern C', 'Bikash Mishra',
  'Anu Srivastava', 'Kanak sharma', 'Atharv Y', 'Santhosh V',
  'Shruti Sinha', 'Apurvaa Biswas', 'Siddhi Shetty', 'Nikita Singh',
  'Kripali Suri',
] as const;

export const INCOMING_AMS = ['Taanya Solanki'] as const;
export const ALL_DROPDOWN_AMS = [...ACTIVE_AMS, ...INCOMING_AMS] as const;

export const POD_MAP: Record<string, Pod> = {
  'Kanak sharma': 'Pod 1',
  'Sudha Goutami': 'Pod 1',
  'Santhosh V': 'Pod 1',
  'Hubern C': 'Pod 2',
  'Sakshi Mamgain': 'Pod 2',
  'Bikash Mishra': 'Pod 3',
  'Anu Srivastava': 'Pod 3',
  'Apurvaa Biswas': 'Pod 4',
  'Atharv Y': 'Pod 4',
  'Shruti Sinha': 'Pod 4',
  'Taanya Solanki': 'Pod 4',
  'Siddhi Shetty': 'Pod 5',
  'Kripali Suri': 'Pod 5',
  'Nikita Singh': 'Floating',
};

export const ALL_PODS: Pod[] = ['Pod 1', 'Pod 2', 'Pod 3', 'Pod 4', 'Pod 5', 'Floating'];

export function podForAm(am: string): Pod {
  return POD_MAP[am] || 'Floating';
}
