export type DemoActorRole = "patient" | "staff";
export type RefillStatus = "none" | "pending" | "approved" | "rejected";

export type DemoState = {
  appointmentBooked: boolean;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
};

export type DemoStateAction =
  | "book-appointment"
  | "complete-intake"
  | "request-refill"
  | "approve-refill"
  | "decline-refill";

export type DemoTransitionResult =
  | { ok: true; state: DemoState }
  | { ok: false; status: 403 | 409; error: string };

export const DEFAULT_DEMO_STATE: DemoState = {
  appointmentBooked: false,
  intakeComplete: false,
  refillStatus: "none",
};

const actions: DemoStateAction[] = [
  "book-appointment",
  "complete-intake",
  "request-refill",
  "approve-refill",
  "decline-refill",
];

export function isDemoStateAction(value: unknown): value is DemoStateAction {
  return typeof value === "string" && actions.includes(value as DemoStateAction);
}

export function transitionDemoState(
  state: DemoState,
  action: DemoStateAction,
  role: DemoActorRole,
): DemoTransitionResult {
  if (
    role === "patient" &&
    !["book-appointment", "complete-intake", "request-refill"].includes(action)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Only clinic staff can review refill requests.",
    };
  }

  if (
    role === "staff" &&
    !["approve-refill", "decline-refill"].includes(action)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Only patients can perform this action.",
    };
  }

  switch (action) {
    case "book-appointment":
      return { ok: true, state: { ...state, appointmentBooked: true } };
    case "complete-intake":
      return { ok: true, state: { ...state, intakeComplete: true } };
    case "request-refill":
      if (state.refillStatus === "pending" || state.refillStatus === "approved") {
        return {
          ok: false,
          status: 409,
          error:
            state.refillStatus === "pending"
              ? "This refill request is already under review."
              : "This refill request has already been approved.",
        };
      }
      return { ok: true, state: { ...state, refillStatus: "pending" } };
    case "approve-refill":
      if (state.refillStatus !== "pending") {
        return {
          ok: false,
          status: 409,
          error: "Only a pending refill request can be approved.",
        };
      }
      return { ok: true, state: { ...state, refillStatus: "approved" } };
    case "decline-refill":
      if (state.refillStatus !== "pending") {
        return {
          ok: false,
          status: 409,
          error: "Only a pending refill request can be declined.",
        };
      }
      return { ok: true, state: { ...state, refillStatus: "rejected" } };
  }
}
