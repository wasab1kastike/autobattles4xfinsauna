import { clonePolicyModifierSummary, createPolicyModifierSummary, type PolicyModifierSummary } from './modifiers.ts';

let activeSummary: PolicyModifierSummary = createPolicyModifierSummary();

export function getActivePolicyModifiers(): PolicyModifierSummary {
  return activeSummary;
}

export function setActivePolicyModifiers(summary: PolicyModifierSummary): PolicyModifierSummary {
  activeSummary = clonePolicyModifierSummary(summary);
  return activeSummary;
}

export function resetPolicyModifiers(): void {
  activeSummary = createPolicyModifierSummary();
}
