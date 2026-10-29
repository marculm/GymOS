export type PlanSearchParams = {
  readonly name?: string;
};

export type SessionSearchParams = {
  readonly planId?: string;
  readonly from?: Date;
  readonly to?: Date;
};
