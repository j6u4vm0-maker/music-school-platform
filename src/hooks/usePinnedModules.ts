import { usePinnedModulesContext } from '@/components/providers/PinnedModulesProvider';

export function usePinnedModules() {
  return usePinnedModulesContext();
}
