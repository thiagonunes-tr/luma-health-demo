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
export type IntakeReason =
  | "Routine follow-up"
  | "New symptoms"
  | "Medication review";
export type IntakeSubmission = {
  reasonForVisit: IntakeReason;
  currentSymptoms: string;
  medicationChanges: string;
  allergies: string;
  submittedAt: string;
};
export type DemoMessage = {
  id: string;
  sender: DemoActorRole;
  body: string;
  sentAt: string;
};
export type InsuranceInfo = {
  provider: string;
  planName: string;
  memberId: string;
  updatedAt: string;
};

export type DemoState = {
  appointmentBooked: boolean;
  appointmentStatus: AppointmentStatus;
  appointmentTime: AppointmentTime;
  intakeComplete: boolean;
  intakeSubmission: IntakeSubmission | null;
  refillStatus: RefillStatus;
  messages: DemoMessage[];
  insurance: InsuranceInfo;
};

export type DemoStateAction =
  | "book-appointment"
  | "reschedule-appointment"
  | "cancel-appointment"
  | "check-in-appointment"
  | "start-appointment"
  | "complete-appointment"
  | "complete-intake"
  | "submit-intake"
  | "send-message"
  | "update-insurance"
  | "request-refill"
  | "approve-refill"
  | "decline-refill";

export type DemoActionInput = {
  appointmentTime?: unknown;
  intake?: unknown;
  messageBody?: unknown;
  insurance?: unknown;
};

export type DemoTransitionResult =
  | { ok: true; state: DemoState }
  | { ok: false; status: 400 | 403 | 409; error: string };

export const DEFAULT_INTAKE_SUBMISSION: IntakeSubmission = {
  reasonForVisit: "Routine follow-up",
  currentSymptoms: "No new symptoms reported",
  medicationChanges: "None",
  allergies: "No known drug allergies",
  submittedAt: "July 24, 2026 at 9:30 AM",
};

export const DEFAULT_MESSAGES: DemoMessage[] = [
  {
    id: "message-1",
    sender: "staff",
    body: "Hi Maria, please complete your intake form before your next visit.",
    sentAt: "Jul 24 · 9:10 AM",
  },
  {
    id: "message-2",
    sender: "patient",
    body: "Thank you. I’ll complete it today.",
    sentAt: "Jul 24 · 9:18 AM",
  },
];

export const DEFAULT_INSURANCE: InsuranceInfo = {
  provider: "HealthFirst Demo",
  planName: "Silver Care",
  memberId: "HF-2048",
  updatedAt: "Initial demo record",
};

export const DEFAULT_DEMO_STATE: DemoState = {
  appointmentBooked: false,
  appointmentStatus: "none",
  appointmentTime: "10:30",
  intakeComplete: false,
  intakeSubmission: null,
  refillStatus: "none",
  messages: DEFAULT_MESSAGES,
  insurance: DEFAULT_INSURANCE,
};

const actions: DemoStateAction[] = [
  "book-appointment",
  "reschedule-appointment",
  "cancel-appointment",
  "check-in-appointment",
  "start-appointment",
  "complete-appointment",
  "complete-intake",
  "submit-intake",
  "send-message",
  "update-insurance",
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

export function isIntakeSubmission(value: unknown): value is IntakeSubmission {
  if (!value || typeof value !== "object") return false;
  const intake = value as Partial<IntakeSubmission>;
  return (
    ["Routine follow-up", "New symptoms", "Medication review"].includes(
      String(intake.reasonForVisit),
    ) &&
    isRequiredText(intake.currentSymptoms, 240) &&
    isRequiredText(intake.medicationChanges, 240) &&
    isRequiredText(intake.allergies, 160) &&
    typeof intake.submittedAt === "string"
  );
}

export function isDemoMessage(value: unknown): value is DemoMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<DemoMessage>;
  return (
    typeof message.id === "string" &&
    (message.sender === "patient" || message.sender === "staff") &&
    isRequiredText(message.body, 500) &&
    typeof message.sentAt === "string"
  );
}

export function isInsuranceInfo(value: unknown): value is InsuranceInfo {
  if (!value || typeof value !== "object") return false;
  const insurance = value as Partial<InsuranceInfo>;
  return (
    isRequiredText(insurance.provider, 80) &&
    isRequiredText(insurance.planName, 80) &&
    isRequiredText(insurance.memberId, 40) &&
    typeof insurance.updatedAt === "string"
  );
}

function isRequiredText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function parseIntake(value: unknown): IntakeSubmission | null {
  if (!value || typeof value !== "object") return null;
  const intake = value as Partial<IntakeSubmission>;
  if (
    !["Routine follow-up", "New symptoms", "Medication review"].includes(
      String(intake.reasonForVisit),
    ) ||
    !isRequiredText(intake.currentSymptoms, 240) ||
    !isRequiredText(intake.medicationChanges, 240) ||
    !isRequiredText(intake.allergies, 160)
  ) {
    return null;
  }
  return {
    reasonForVisit: intake.reasonForVisit as IntakeReason,
    currentSymptoms: intake.currentSymptoms.trim(),
    medicationChanges: intake.medicationChanges.trim(),
    allergies: intake.allergies.trim(),
    submittedAt: "July 24, 2026 at 9:30 AM",
  };
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
      "submit-intake",
      "send-message",
      "update-insurance",
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
      "send-message",
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
      return {
        ok: true,
        state: {
          ...state,
          intakeComplete: true,
          intakeSubmission: DEFAULT_INTAKE_SUBMISSION,
        },
      };
    case "submit-intake": {
      const intakeSubmission = parseIntake(input.intake);
      if (!intakeSubmission) {
        return {
          ok: false,
          status: 400,
          error:
            "Complete every intake field within the allowed character limits.",
        };
      }
      return {
        ok: true,
        state: { ...state, intakeComplete: true, intakeSubmission },
      };
    }
    case "send-message": {
      if (!isRequiredText(input.messageBody, 500)) {
        return {
          ok: false,
          status: 400,
          error: "Enter a message with no more than 500 characters.",
        };
      }
      const sequence = state.messages.length + 1;
      return {
        ok: true,
        state: {
          ...state,
          messages: [
            ...state.messages,
            {
              id: `message-${sequence}`,
              sender: role,
              body: input.messageBody.trim(),
              sentAt: "Jul 24 · Now",
            },
          ],
        },
      };
    }
    case "update-insurance": {
      if (!input.insurance || typeof input.insurance !== "object") {
        return {
          ok: false,
          status: 400,
          error: "Complete every insurance field.",
        };
      }
      const insurance = input.insurance as Partial<InsuranceInfo>;
      if (
        !isRequiredText(insurance.provider, 80) ||
        !isRequiredText(insurance.planName, 80) ||
        !isRequiredText(insurance.memberId, 40)
      ) {
        return {
          ok: false,
          status: 400,
          error: "Complete every insurance field.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          insurance: {
            provider: insurance.provider.trim(),
            planName: insurance.planName.trim(),
            memberId: insurance.memberId.trim(),
            updatedAt: "July 24, 2026 at 10:05 AM",
          },
        },
      };
    }
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
