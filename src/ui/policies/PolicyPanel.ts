import { GameState, Resource } from '../../core/GameState.ts';
import {
  listPolicies,
  POLICY_EVENTS,
  type PolicyAppliedEvent,
  type PolicyDefinition,
  type PolicyRejectedEvent,
} from '../../data/policies.ts';
import { eventBus } from '../../events';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const resourceLabel: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer Bottles',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu',
};

type PolicyUiElements = {
  card: HTMLElement;
  action: HTMLButtonElement;
  stateBadge: HTMLSpanElement;
  statusCopy: HTMLParagraphElement;
  requirements: HTMLUListElement;
  costChip: HTMLSpanElement;
};

export interface PolicyPanelController {
  destroy(): void;
}

export function createPolicyPanel(container: HTMLElement, state: GameState): PolicyPanelController {
  const doc = container.ownerDocument ?? document;
  const policies = listPolicies();
  const policyElements = new Map<PolicyDefinition['id'], PolicyUiElements>();
  const disposers: Array<() => void> = [];

  function createBadge(text: string): HTMLSpanElement {
    const badge = doc.createElement('span');
    badge.className = 'policy-card__badge';
    badge.textContent = text;
    return badge;
  }

  function createPolicyCard(def: PolicyDefinition): HTMLElement {
    const card = doc.createElement('article');
    card.className = 'policy-card';
    card.style.setProperty('--policy-gradient', def.visuals.gradient);
    card.style.setProperty('--policy-accent', def.visuals.accentColor);

    const header = doc.createElement('div');
    header.className = 'policy-card__header';

    const iconFrame = doc.createElement('div');
    iconFrame.className = 'policy-card__icon-frame';

    const icon = doc.createElement('img');
    icon.className = 'policy-card__icon';
    icon.src = def.visuals.icon;
    icon.alt = `${def.name} icon`;
    iconFrame.appendChild(icon);

    const heading = doc.createElement('div');
    heading.className = 'policy-card__heading';

    const title = doc.createElement('h4');
    title.className = 'policy-card__title';
    title.textContent = def.name;
    heading.appendChild(title);

    if (def.visuals.badges?.length) {
      const badgeStrip = doc.createElement('div');
      badgeStrip.className = 'policy-card__badges';
      def.visuals.badges.forEach((text) => badgeStrip.appendChild(createBadge(text)));
      heading.appendChild(badgeStrip);
    }

    const stateBadge = doc.createElement('span');
    stateBadge.className = 'policy-card__state';
    stateBadge.textContent = 'Ready';

    header.append(iconFrame, heading, stateBadge);

    const description = doc.createElement('p');
    description.className = 'policy-card__description';
    description.textContent = def.description;

    const flair = def.visuals.flair
      ? (() => {
          const flairLine = doc.createElement('p');
          flairLine.className = 'policy-card__flair';
          flairLine.textContent = def.visuals.flair ?? '';
          return flairLine;
        })()
      : null;

    const actions = doc.createElement('div');
    actions.className = 'policy-card__actions';

    const costChip = doc.createElement('span');
    costChip.className = 'policy-card__cost';

    const costLabel = doc.createElement('span');
    costLabel.className = 'policy-card__cost-label';
    costLabel.textContent = 'Cost';

    const costValue = doc.createElement('span');
    costValue.className = 'policy-card__cost-value';
    costValue.textContent = `${numberFormatter.format(def.cost)} ${resourceLabel[def.resource]}`;
    costChip.append(costLabel, costValue);

    const action = doc.createElement('button');
    action.type = 'button';
    action.className = 'policy-card__action';
    action.textContent = 'Enact Policy';

    const statusCopy = doc.createElement('p');
    statusCopy.className = 'policy-card__status';

    const requirements = doc.createElement('ul');
    requirements.className = 'policy-card__requirements';
    requirements.hidden = true;

    actions.append(costChip, action);

    const handleClick = (): void => {
      if (state.applyPolicy(def.id)) {
        updatePolicyCard(def);
      }
    };
    action.addEventListener('click', handleClick);
    disposers.push(() => action.removeEventListener('click', handleClick));

    card.append(header, description);
    if (flair) {
      card.appendChild(flair);
    }
    card.append(actions, statusCopy, requirements);

    policyElements.set(def.id, {
      card,
      action,
      stateBadge,
      statusCopy,
      requirements,
      costChip,
    });

    return card;
  }

  function updatePolicyCard(def: PolicyDefinition): void {
    const elements = policyElements.get(def.id);
    if (!elements) {
      return;
    }

    const applied = state.hasPolicy(def.id);
    const missing = def.prerequisites.filter((req) => !req.isSatisfied(state));
    const affordable = state.canAfford(def.cost, def.resource);

    elements.action.disabled = applied || missing.length > 0 || !affordable;
    elements.action.textContent = applied ? 'Enacted' : 'Enact Policy';

    let status = 'ready';
    let badgeText = 'Ready';
    let statusLine = def.spotlight ?? 'All signals point to go.';

    elements.requirements.innerHTML = '';
    elements.requirements.hidden = true;

    if (applied) {
      status = 'applied';
      badgeText = 'Enacted';
      statusLine = def.visuals.flair ?? 'Policy active.';
    } else if (missing.length > 0) {
      status = 'locked';
      badgeText = 'Locked';
      statusLine = 'Awaiting requirements:';
      elements.requirements.hidden = false;
      missing.forEach((req) => {
        const item = doc.createElement('li');
        item.textContent = req.description;
        elements.requirements.appendChild(item);
      });
    } else if (!affordable) {
      status = 'budget';
      badgeText = 'Needs Resources';
      statusLine = `Earn ${numberFormatter.format(def.cost)} ${resourceLabel[def.resource]} to enact this edict.`;
    }

    elements.card.dataset.status = status;
    elements.stateBadge.textContent = badgeText;
    elements.statusCopy.textContent = statusLine;
    const emphasizeCost = !applied && missing.length === 0 && !affordable;
    elements.costChip.classList.toggle('policy-card__cost--warning', emphasizeCost);
  }

  function updatePolicyCards(): void {
    policies.forEach((policy) => updatePolicyCard(policy));
  }

  function renderPolicies(): void {
    const grid = doc.createElement('div');
    grid.className = 'policy-grid';
    policyElements.clear();
    policies.forEach((policy) => {
      const card = createPolicyCard(policy);
      grid.appendChild(card);
    });
    container.replaceChildren(grid);
    updatePolicyCards();
  }

  renderPolicies();

  const handleResourceChanged = (_payload: unknown): void => updatePolicyCards();
  const handlePolicyApplied = (_event: PolicyAppliedEvent): void => updatePolicyCards();
  const handlePolicyRejected = (_event: PolicyRejectedEvent): void => updatePolicyCards();

  eventBus.on('resourceChanged', handleResourceChanged);
  eventBus.on(POLICY_EVENTS.APPLIED, handlePolicyApplied);
  eventBus.on(POLICY_EVENTS.REJECTED, handlePolicyRejected);

  const destroy = (): void => {
    eventBus.off('resourceChanged', handleResourceChanged);
    eventBus.off(POLICY_EVENTS.APPLIED, handlePolicyApplied);
    eventBus.off(POLICY_EVENTS.REJECTED, handlePolicyRejected);
    disposers.forEach((dispose) => dispose());
    policyElements.clear();
  };

  return {
    destroy,
  };
}
