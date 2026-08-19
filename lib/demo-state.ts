export type DemoActorRole = "patient" | "staff";
export type RefillStatus = "none" | "pending" | "approved" | "rejected";

/**
 * A medication the patient can request a refill for. The previous model held one
 * global refill status with no medication attached, so the staff card had to name
 * a drug that no field carried.
 */
export type Medication = {
  id: string;
  name: string;
  dose: string;
  instructions: string;
  lastFilled: string;
  refillStatus: RefillStatus;
};

/** A lab result with a read lifecycle, so "new result" is observable state. */
export type LabResultStatus = "new" | "viewed";
export type LabResult = {
  id: string;
  name: string;
  plainName: string;
  collectedAt: string;
  summary: string;
  status: LabResultStatus;
  values: { test: string; result: string; range: string }[];
};

/** A fictional statement. Amounts are demo data and no money moves. */
export type StatementStatus = "unpaid" | "paid";
export type Statement = {
  id: string;
  description: string;
  amount: string;
  dueOn: string;
  status: StatementStatus;
};
export type AppointmentStatus =
  | "none"
  | "scheduled"
  | "confirmed"
  | "checked-in"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "no-show";
export type AppointmentTime = "09:00" | "10:30" | "15:00";
export type AppointmentProvider = "Dr. Ana Costa" | "Dr. John Lima";
export type AppointmentSpecialty =
  | "Primary Care"
  | "Cardiology"
  | "Dermatology";

/** Statuses in which a visit is still ahead of the patient. */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked-in",
];

/** Statuses that keep `appointmentBooked` true. */
export const BOOKED_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked-in",
  "in-progress",
];
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

/** Last message id each role has read, used to derive an unread count. */
export type MessageReadState = { patient: string | null; staff: string | null };

export type DemoState = {
  appointmentStatus: AppointmentStatus;
  appointmentTime: AppointmentTime;
  appointmentProvider: AppointmentProvider | null;
  appointmentSpecialty: AppointmentSpecialty | null;
  intakeSubmission: IntakeSubmission | null;
  messages: DemoMessage[];
  lastRead: MessageReadState;
  insurance: InsuranceInfo;
  medications: Medication[];
  results: LabResult[];
  statement: Statement;
};

export type DemoStateAction =
  | "book-appointment"
  | "confirm-appointment"
  | "reschedule-appointment"
  | "cancel-appointment"
  | "check-in-appointment"
  | "no-show-appointment"
  | "start-appointment"
  | "complete-appointment"
  | "complete-intake"
  | "submit-intake"
  | "send-message"
  | "mark-messages-read"
  | "update-insurance"
  | "request-refill"
  | "approve-refill"
  | "decline-refill"
  | "acknowledge-result"
  | "pay-statement";

export type DemoActionInput = {
  appointmentTime?: unknown;
  provider?: unknown;
  specialty?: unknown;
  intake?: unknown;
  messageBody?: unknown;
  insurance?: unknown;
  medicationId?: unknown;
  resultId?: unknown;
};

export type DemoTransitionResult =
  | { ok: true; state: DemoState }
  | { ok: false; status: 400 | 403 | 409; error: string };

export const INTAKE_REQUIRES_APPOINTMENT =
  "Book an appointment before completing your pre-visit questions.";

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

export const DEFAULT_MEDICATIONS: Medication[] = [
  {
    id: "med-losartan",
    name: "Losartan 50 mg",
    dose: "One tablet each morning",
    instructions: "Blood pressure medicine. Take with water.",
    lastFilled: "June 24, 2026",
    refillStatus: "none",
  },
  {
    id: "med-metformin",
    name: "Metformin 500 mg",
    dose: "One tablet twice a day",
    instructions: "Blood sugar medicine. Take with food.",
    lastFilled: "July 2, 2026",
    refillStatus: "none",
  },
  {
    id: "med-atorvastatin",
    name: "Atorvastatin 20 mg",
    dose: "One tablet at night",
    instructions: "Cholesterol medicine.",
    lastFilled: "May 30, 2026",
    refillStatus: "none",
  },
];

export const DEFAULT_RESULTS: LabResult[] = [
  {
    id: "result-cbc",
    name: "Complete blood count",
    plainName: "A routine blood test measuring red cells, white cells and platelets",
    collectedAt: "July 23, 2026 at 8:15 AM",
    summary: "All values in range",
    status: "new",
    values: [
      { test: "Hemoglobin", result: "13.6 g/dL", range: "12.0–15.5" },
      { test: "White blood cells", result: "6.4 K/uL", range: "4.5–11.0" },
      { test: "Platelets", result: "248 K/uL", range: "150–450" },
    ],
  },
  {
    id: "result-lipids",
    name: "Lipid panel",
    plainName: "A blood test measuring cholesterol and related fats",
    collectedAt: "July 23, 2026 at 8:15 AM",
    summary: "One value above range",
    status: "new",
    values: [
      { test: "Total cholesterol", result: "212 mg/dL", range: "under 200" },
      { test: "HDL", result: "58 mg/dL", range: "over 40" },
      { test: "Triglycerides", result: "129 mg/dL", range: "under 150" },
    ],
  },
];

export const DEFAULT_STATEMENT: Statement = {
  id: "statement-jul",
  description: "Primary care follow-up · July 12, 2026",
  amount: "$40.00",
  dueOn: "August 12, 2026",
  status: "unpaid",
};

export const DEFAULT_INSURANCE: InsuranceInfo = {
  provider: "HealthFirst Demo",
  planName: "Silver Care",
  memberId: "HF-2048",
  updatedAt: "Initial demo record",
};

export const DEFAULT_LAST_READ: MessageReadState = {
  patient: null,
  staff: null,
};

export const DEFAULT_DEMO_STATE: DemoState = {
  appointmentStatus: "none",
  appointmentTime: "10:30",
  appointmentProvider: null,
  appointmentSpecialty: null,
  intakeSubmission: null,
  messages: DEFAULT_MESSAGES,
  lastRead: DEFAULT_LAST_READ,
  insurance: DEFAULT_INSURANCE,
  medications: DEFAULT_MEDICATIONS,
  results: DEFAULT_RESULTS,
  statement: DEFAULT_STATEMENT,
};

export const DEMO_STATE_ACTIONS: DemoStateAction[] = [
  "book-appointment",
  "confirm-appointment",
  "reschedule-appointment",
  "cancel-appointment",
  "check-in-appointment",
  "no-show-appointment",
  "start-appointment",
  "complete-appointment",
  "complete-intake",
  "submit-intake",
  "send-message",
  "mark-messages-read",
  "update-insurance",
  "request-refill",
  "approve-refill",
  "decline-refill",
  "acknowledge-result",
  "pay-statement",
];

export function isDemoStateAction(value: unknown): value is DemoStateAction {
  return (
    typeof value === "string" &&
    DEMO_STATE_ACTIONS.includes(value as DemoStateAction)
  );
}

export function isAppointmentTime(value: unknown): value is AppointmentTime {
  return ["09:00", "10:30", "15:00"].includes(String(value));
}

export function isAppointmentProvider(
  value: unknown,
): value is AppointmentProvider {
  return ["Dr. Ana Costa", "Dr. John Lima"].includes(String(value));
}

export function isAppointmentSpecialty(
  value: unknown,
): value is AppointmentSpecialty {
  return ["Primary Care", "Cardiology", "Dermatology"].includes(String(value));
}

export function isMessageReadState(value: unknown): value is MessageReadState {
  if (!value || typeof value !== "object") return false;
  const read = value as Partial<MessageReadState>;
  return (
    (read.patient === null || typeof read.patient === "string") &&
    (read.staff === null || typeof read.staff === "string")
  );
}

/**
 * Messages addressed to `role` that arrived after the last one it read.
 * Replaces the badge that used to render `messages.length`, which counted the
 * reader's own sent messages.
 */
export function countUnreadMessages(
  state: DemoState,
  role: DemoActorRole,
): number {
  const lastReadId = state.lastRead[role];
  const lastReadIndex = lastReadId
    ? state.messages.findIndex((message) => message.id === lastReadId)
    : -1;
  return state.messages
    .slice(lastReadIndex + 1)
    .filter((message) => message.sender !== role).length;
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

export function isRefillStatus(value: unknown): value is RefillStatus {
  return ["none", "pending", "approved", "rejected"].includes(String(value));
}

export function isMedication(value: unknown): value is Medication {
  if (!value || typeof value !== "object") return false;
  const med = value as Partial<Medication>;
  return (
    isRequiredText(med.id, 60) &&
    isRequiredText(med.name, 80) &&
    isRequiredText(med.dose, 120) &&
    isRequiredText(med.instructions, 200) &&
    typeof med.lastFilled === "string" &&
    isRefillStatus(med.refillStatus)
  );
}

export function isLabResult(value: unknown): value is LabResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<LabResult>;
  return (
    isRequiredText(result.id, 60) &&
    isRequiredText(result.name, 80) &&
    isRequiredText(result.plainName, 200) &&
    typeof result.collectedAt === "string" &&
    typeof result.summary === "string" &&
    ["new", "viewed"].includes(String(result.status)) &&
    Array.isArray(result.values) &&
    result.values.every(
      row =>
        !!row &&
        typeof row === "object" &&
        isRequiredText((row as { test?: unknown }).test, 80) &&
        isRequiredText((row as { result?: unknown }).result, 40) &&
        isRequiredText((row as { range?: unknown }).range, 40),
    )
  );
}

export function isStatement(value: unknown): value is Statement {
  if (!value || typeof value !== "object") return false;
  const statement = value as Partial<Statement>;
  return (
    isRequiredText(statement.id, 60) &&
    isRequiredText(statement.description, 200) &&
    isRequiredText(statement.amount, 20) &&
    typeof statement.dueOn === "string" &&
    ["unpaid", "paid"].includes(String(statement.status))
  );
}

/** Medications the patient can act on right now. */
export function countRefillableMedications(state: DemoState): number {
  return state.medications.filter(
    med => med.refillStatus === "none" || med.refillStatus === "rejected",
  ).length;
}

/** Refills waiting on a clinic decision. */
export function countPendingRefills(state: DemoState): number {
  return state.medications.filter(med => med.refillStatus === "pending").length;
}

/** Results the patient has not opened yet. */
export function countNewResults(state: DemoState): number {
  return state.results.filter(result => result.status === "new").length;
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
      "confirm-appointment",
      "reschedule-appointment",
      "cancel-appointment",
      "check-in-appointment",
      "complete-intake",
      "submit-intake",
      "send-message",
      "mark-messages-read",
      "update-insurance",
      "request-refill",
      "acknowledge-result",
      "pay-statement",
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
      "no-show-appointment",
      "start-appointment",
      "complete-appointment",
      "send-message",
      "mark-messages-read",
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
        state.appointmentStatus !== "completed" &&
        state.appointmentStatus !== "no-show"
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
      if (input.provider !== undefined && !isAppointmentProvider(input.provider)) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available provider.",
        };
      }
      if (
        input.specialty !== undefined &&
        !isAppointmentSpecialty(input.specialty)
      ) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available specialty.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentStatus: "scheduled",
          appointmentTime: input.appointmentTime,
          appointmentProvider: isAppointmentProvider(input.provider)
            ? input.provider
            : "Dr. Ana Costa",
          appointmentSpecialty: isAppointmentSpecialty(input.specialty)
            ? input.specialty
            : "Primary Care",
        },
      };
    }
    case "confirm-appointment":
      if (state.appointmentStatus !== "scheduled") {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled appointment can be confirmed.",
        };
      }
      return {
        ok: true,
        state: { ...state, appointmentStatus: "confirmed" },
      };
    case "reschedule-appointment":
      if (
        state.appointmentStatus !== "scheduled" &&
        state.appointmentStatus !== "confirmed"
      ) {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled or confirmed appointment can be rescheduled.",
        };
      }
      if (!isAppointmentTime(input.appointmentTime)) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available appointment time.",
        };
      }
      if (input.provider !== undefined && !isAppointmentProvider(input.provider)) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available provider.",
        };
      }
      if (
        input.specialty !== undefined &&
        !isAppointmentSpecialty(input.specialty)
      ) {
        return {
          ok: false,
          status: 400,
          error: "Choose an available specialty.",
        };
      }
      // A new time invalidates the previous confirmation.
      return {
        ok: true,
        state: {
          ...state,
          appointmentStatus: "scheduled",
          appointmentTime: input.appointmentTime,
          appointmentProvider: isAppointmentProvider(input.provider)
            ? input.provider
            : state.appointmentProvider,
          appointmentSpecialty: isAppointmentSpecialty(input.specialty)
            ? input.specialty
            : state.appointmentSpecialty,
        },
      };
    case "cancel-appointment":
      if (
        state.appointmentStatus !== "scheduled" &&
        state.appointmentStatus !== "confirmed"
      ) {
        return {
          ok: false,
          status: 409,
          error: "Only a scheduled or confirmed appointment can be cancelled.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentStatus: "cancelled",
          appointmentProvider: null,
          appointmentSpecialty: null,
        },
      };
    case "check-in-appointment":
      if (state.appointmentStatus !== "confirmed") {
        return {
          ok: false,
          status: 409,
          error: "Confirm the appointment before checking in.",
        };
      }
      return {
        ok: true,
        state: { ...state, appointmentStatus: "checked-in" },
      };
    case "no-show-appointment":
      if (
        state.appointmentStatus !== "scheduled" &&
        state.appointmentStatus !== "confirmed"
      ) {
        return {
          ok: false,
          status: 409,
          error: "Only an appointment still awaiting arrival can be marked as not attended.",
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          appointmentStatus: "no-show",
        },
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
          appointmentStatus: "completed",
        },
      };

    case "complete-intake":
      if (!ACTIVE_APPOINTMENT_STATUSES.includes(state.appointmentStatus)) {
        return {
          ok: false,
          status: 409,
          error: INTAKE_REQUIRES_APPOINTMENT,
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          intakeSubmission: DEFAULT_INTAKE_SUBMISSION,
        },
      };
    case "submit-intake": {
      if (!ACTIVE_APPOINTMENT_STATUSES.includes(state.appointmentStatus)) {
        return {
          ok: false,
          status: 409,
          error: INTAKE_REQUIRES_APPOINTMENT,
        };
      }
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
        state: { ...state, intakeSubmission },
      };
    }
    case "mark-messages-read": {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage || state.lastRead[role] === lastMessage.id) {
        return { ok: true, state };
      }
      return {
        ok: true,
        state: {
          ...state,
          lastRead: { ...state.lastRead, [role]: lastMessage.id },
        },
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
    case "approve-refill":
    case "decline-refill": {
      // Refills are per medication now, so every one of these needs to say
      // WHICH medication. A missing or unknown id is a 400, not a 409: the
      // request is malformed rather than out of sequence.
      const medicationId = typeof input.medicationId === "string"
        ? input.medicationId
        : "";
      const index = state.medications.findIndex(med => med.id === medicationId);
      if (index === -1) {
        return {
          ok: false,
          status: 400,
          error: "Choose one of the medications on file.",
        };
      }
      const medication = state.medications[index];

      const next: RefillStatus | null = action === "request-refill"
        ? (medication.refillStatus === "none" || medication.refillStatus === "rejected"
            ? "pending"
            : null)
        : medication.refillStatus === "pending"
          ? (action === "approve-refill" ? "approved" : "rejected")
          : null;

      if (next === null) {
        const reason = action === "request-refill"
          ? (medication.refillStatus === "pending"
              ? `A refill for ${medication.name} is already under review.`
              : `The refill for ${medication.name} has already been approved.`)
          : `Only a pending refill can be ${action === "approve-refill" ? "approved" : "declined"}.`;
        return { ok: false, status: 409, error: reason };
      }

      const medications = state.medications.map((med, position) =>
        position === index ? { ...med, refillStatus: next } : med,
      );
      return { ok: true, state: { ...state, medications } };
    }
    case "acknowledge-result": {
      const resultId = typeof input.resultId === "string" ? input.resultId : "";
      if (!state.results.some(result => result.id === resultId)) {
        return {
          ok: false,
          status: 400,
          error: "Choose one of the results on file.",
        };
      }
      // Opening an already-read result is not an error, just a no-op.
      const results = state.results.map(result =>
        result.id === resultId ? { ...result, status: "viewed" as const } : result,
      );
      return { ok: true, state: { ...state, results } };
    }
    case "pay-statement":
      if (state.statement.status === "paid") {
        return {
          ok: false,
          status: 409,
          error: "This statement has already been settled.",
        };
      }
      return {
        ok: true,
        state: { ...state, statement: { ...state.statement, status: "paid" } },
      };
  }
}
