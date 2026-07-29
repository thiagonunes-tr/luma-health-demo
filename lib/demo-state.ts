export type DemoActorRole = "patient" | "staff";
export type RefillStatus = "none" | "pending" | "approved" | "rejected";
export type AppointmentStatus =
  | "none"
  | "scheduled"
  | "checked-in"
  | "in-progress"
  | "completed"
  | "cancelled";
export type AppointmentTime = "09:00" | "10:30" | "15:00";

export type DemoState = {
  appointmentBooked: boolean;
  appointmentStatus: AppointmentStatus;
  appointmentTime: AppointmentTime;
  intakeComplete: boolean;
  refillStatus: RefillStatus;
};

export type DemoStateAction =
  | "book-appointment"
  | "reschedule-appointment"
  | "cancel-appointment"
  | "check-in-appointment"
  | "start-appointment"
  | "complete-appointment"
  | "complete-intake"
  | "request-refill"
  | "approve-refill"
  | "decline-refill";

export type DemoActionInput = {
  appointmentTime?: unknown;
};

export type DemoTransitionResult =
  | { ok: true; state: DemoState }
  | { ok: false; status: 400 | 403 | 409; error: string };

export const DEFAULT_DEMO_STATE: DemoState = {
  appointmentBooked: false,
  appointmentStatus: "none",
  appointmentTime: "10:30",
  intakeComplete: false,
  refillStatus: "none",
};

const actions: DemoStateAction[] = [
  "book-appointment",
  "reschedule-appointment",
  "cancel-appointment",
  "check-in-appointment",
  "start-appointment",
  "complete-appointment",
  "complete-intake",
  "request-refill",
  "approve-refill",
  "decline-refill",
];

export function isDemoStateAction(value: unknown): value is DemoStateAction {
  return typeof value === "string" && actions.includes(value as DemoStateAction);
}

export function isAppointmentTime(value: unknown): value is AppointmentTime {
  return ["09:00", "10:30", "15:00"].includes(String(value));
}

export function transitionDemoState(
  state: DemoState,
  action: DemoStateAction,
  role: DemoActorRole,
  input: DemoActionInput = {},
): DemoTransitionResult {
  if (
    role === "patient" &&
    ![
      "book-appointment",
      "reschedule-appointment",
      "cancel-appointment",
      "complete-intake",
      "request-refill",
    ].includes(action)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Only clinic staff can perform this action.",
    };
  }

  if (
    role === "staff" &&
    ![
      "check-in-appointment",
      "start-appointment",
      "complete-appointment",
      "approve-refill",
      "decline-refill",
    ].includes(action)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Only patients can perform this action.",
    };
  }

  switch (action) {
    case "book-appointment": {
      if (
        state.appointmentStatus !== "none" &&
        state.appointmentStatus !== "cancelled" &&
        state.appointmentStatus !== "completed"
      ) {
        return {
          ok: false,
          status: 409,
          error: "Manage the existing appointment before booking another one.",
        };
      }
      if (!isAppointmentTime(input.appointmentTime)) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available appointment time.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentBooked: true,
          appointmentStatus: "scheduled",
          appointmentTime: input.appointmentTime,
        },
      };
    }
    case "reschedule-appointment":
      if (state.appointmentStatus !== "scheduled") {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled appointment can be rescheduled.",
        };
      }
      if (!isAppointmentTime(input.appointmentTime)) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available appointment time.",
        };
      }
      return {
        ok: true,
        state: { ...state, appointmentTime: input.appointmentTime },
      };
    case "cancel-appointment":
      if (state.appointmentStatus !== "scheduled") {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled appointment can be cancelled.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentBooked: false,
          appointmentStatus: "cancelled",
        },
      };
    case "check-in-appointment":
      if (state.appointmentStatus !== "scheduled") {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled appointment can be checked in.",
        };
      }
      return {
        ok: true,
        state: { ...state, appointmentStatus: "checked-in" },
      };
    case "start-appointment":
      if (state.appointmentStatus !== "checked-in") {
        return {
          ok: false,
          status: 409,
          error: "Only a checked-in appointment can be started.",
        };
      }
      return {
        ok: true,
        state: { ...state, appointmentStatus: "in-progress" },
      };
    case "complete-appointment":
      if (state.appointmentStatus !== "in-progress") {
        return {
          ok: false,
          status: 409,
          error: "Only an appointment in progress can be completed.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentBooked: false,
          appointmentStatus: "completed",
        },
      };
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
