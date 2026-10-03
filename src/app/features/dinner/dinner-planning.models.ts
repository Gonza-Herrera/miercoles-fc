import { EventStatus } from '../events/event.models';

export interface DinnerPlannedPurchase {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
}

export interface DinnerPurchaseOwner {
  readonly active: boolean;
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly groupMemberId: string;
  readonly nickname: string | null;
}

export interface DinnerPlan {
  readonly eventId: string;
  readonly id: string;
  readonly menu: string | null;
  readonly plannedPurchases: readonly DinnerPlannedPurchase[];
  readonly purchaseOwner: DinnerPurchaseOwner | null;
  readonly updatedAt: string;
}

export interface DinnerPlanningView {
  readonly canEdit: boolean;
  readonly confirmedDinerCount: number;
  readonly eventId: string;
  readonly eventStatus: EventStatus;
  readonly plan: DinnerPlan | null;
}

export interface DinnerPlanDraft {
  readonly menu: string;
  readonly plannedPurchases: readonly DinnerPlannedPurchase[];
  readonly purchaseOwnerGroupMemberId: string | null;
}

export type DinnerPlanningOperation =
  | 'CONFLICT'
  | 'LOAD'
  | 'NOT_FOUND'
  | 'OWNER_INVALID'
  | 'PERMISSION'
  | 'READ_ONLY'
  | 'SAVE'
  | 'VALIDATION';

export class DinnerPlanningOperationError extends Error {
  constructor(readonly operation: DinnerPlanningOperation) {
    super(operation);
    this.name = 'DinnerPlanningOperationError';
  }
}

export function emptyDinnerPlanDraft(plan: DinnerPlan | null): DinnerPlanDraft {
  return {
    menu: plan?.menu ?? '',
    plannedPurchases: plan?.plannedPurchases.map((item) => ({ ...item })) ?? [],
    purchaseOwnerGroupMemberId: plan?.purchaseOwner?.groupMemberId ?? null,
  };
}
