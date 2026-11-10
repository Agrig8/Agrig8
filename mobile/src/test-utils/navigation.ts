import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

export function createTestNavigation<RouteName extends keyof RootStackParamList & string>(
  navigation: object,
): StackScreenProps<RootStackParamList, RouteName>['navigation'] {
  return navigation as unknown as StackScreenProps<RootStackParamList, RouteName>['navigation'];
}

export function createTestRoute<RouteName extends keyof RootStackParamList & string>(
  name: RouteName,
  params: RootStackParamList[RouteName],
): StackScreenProps<RootStackParamList, RouteName>['route'] {
  return {
    key: String(name),
    name,
    params,
  } as unknown as StackScreenProps<RootStackParamList, RouteName>['route'];
}
