import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DEMO_STATE,
  DEFAULT_INTAKE_SUBMISSION,
  isDemoStateAction,
  transitionDemoState,
} from "../lib/demo-state";

test("recognizes only supported demo actions", () => {
  assert.equal(isDemoStateAction("book-appointment"), true);
  assert.equal(isDemoStateAction("complete-appointment"), true);
  assert.equal(isDemoStateAction("submit-intake"), true);
  assert.equal(isDemoStateAction("send-message"), true);
  assert.equal(isDemoStateAction("update-insurance"), true);
  assert.equal(isDemoStateAction("decline-refill"), true);
  assert.equal(isDemoStateAction("overwrite-state"), false);
  assert.equal(isDemoStateAction(null), false);
});

test("patient actions update only their intended field", () => {
  const booked = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "patient",
    { appointmentTime: "10:30" },
  );
  assert.equal(booked.ok, true);
  if (!booked.ok) return;
  assert.deepEqual(booked.state, {
    ...DEFAULT_DEMO_STATE,
    appointmentBooked: true,
    appointmentStatus: "scheduled",
    appointmentTime: "10:30",
  });

  const intake = transitionDemoState(
    booked.state,
    "complete-intake",
    "patient",
  );
  assert.equal(intake.ok, true);
  if (!intake.ok) return;
  assert.deepEqual(intake.state, {
    ...booked.state,
    intakeComplete: true,
    intakeSubmission: DEFAULT_INTAKE_SUBMISSION,
  });
});

test("patient submits structured intake data for staff review", () => {
  const submitted = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "submit-intake",
    "patient",
    {
      intake: {
        reasonForVisit: "New symptoms",
        currentSymptoms: "Occasional headache",
        medicationChanges: "Started vitamin D",
        allergies: "Penicillin",
      },
    },
  );
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal(submitted.state.intakeComplete, true);
  assert.deepEqual(submitted.state.intakeSubmission, {
    reasonForVisit: "New symptoms",
    currentSymptoms: "Occasional headache",
    medicationChanges: "Started vitamin D",
    allergies: "Penicillin",
    submittedAt: "July 24, 2026 at 9:30 AM",
  });

  const invalid = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "submit-intake",
    "patient",
    {
      intake: {
        reasonForVisit: "New symptoms",
        currentSymptoms: "",
        medicationChanges: "None",
        allergies: "None",
      },
    },
  );
  assert.deepEqual(invalid, {
    ok: false,
    status: 400,
    error: "Complete every intake field within the allowed character limits.",
  });
});

test("patient and staff append messages to the shared thread", () => {
  const patientMessage = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "send-message",
    "patient",
    { messageBody: "  Can I bring my medication list?  " },
  );
  assert.equal(patientMessage.ok, true);
  if (!patientMessage.ok) return;
  assert.deepEqual(patientMessage.state.messages.at(-1), {
    id: "message-3",
    sender: "patient",
    body: "Can I bring my medication list?",
    sentAt: "Jul 24 · Now",
  });

  const staffMessage = transitionDemoState(
    patientMessage.state,
    "send-message",
    "staff",
    { messageBody: "Yes, please bring it." },
  );
  assert.equal(staffMessage.ok, true);
  if (!staffMessage.ok) return;
  assert.equal(staffMessage.state.messages.length, 4);
  assert.equal(staffMessage.state.messages.at(-1)?.sender, "staff");

  const empty = transitionDemoState(
    staffMessage.state,
    "send-message",
    "patient",
    { messageBody: "   " },
  );
  assert.deepEqual(empty, {
    ok: false,
    status: 400,
    error: "Enter a message with no more than 500 characters.",
  });
});

test("patient updates validated insurance information", () => {
  const updated = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "update-insurance",
    "patient",
    {
      insurance: {
        provider: " Demo Health ",
        planName: " QA Gold ",
        memberId: " QA-9001 ",
      },
    },
  );
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.deepEqual(updated.state.insurance, {
    provider: "Demo Health",
    planName: "QA Gold",
    memberId: "QA-9001",
    updatedAt: "July 24, 2026 at 10:05 AM",
  });

  const invalid = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "update-insurance",
    "patient",
    {
      insurance: {
        provider: "",
        planName: "QA Gold",
        memberId: "QA-9001",
      },
    },
  );
  assert.deepEqual(invalid, {
    ok: false,
    status: 400,
    error: "Complete every insurance field.",
  });

  const staffUpdate = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "update-insurance",
    "staff",
  );
  assert.equal(staffUpdate.ok, false);
  if (staffUpdate.ok) return;
  assert.equal(staffUpdate.status, 403);
});

test("patient can submit one pending refill request", () => {
  const requested = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "request-refill",
    "patient",
  );
  assert.equal(requested.ok, true);
  if (!requested.ok) return;
  assert.equal(requested.state.refillStatus, "pending");

  const duplicate = transitionDemoState(
    requested.state,
    "request-refill",
    "patient",
  );
  assert.deepEqual(duplicate, {
    ok: false,
    status: 409,
    error: "This refill request is already under review.",
  });
});

test("staff can approve only a pending refill", () => {
  const withoutRequest = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "approve-refill",
    "staff",
  );
  assert.equal(withoutRequest.ok, false);
  if (withoutRequest.ok) return;
  assert.equal(withoutRequest.status, 409);

  const pending = {
    ...DEFAULT_DEMO_STATE,
    refillStatus: "pending" as const,
  };
  const approved = transitionDemoState(pending, "approve-refill", "staff");
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.equal(approved.state.refillStatus, "approved");
});

test("declined refill can be submitted again by the patient", () => {
  const pending = {
    ...DEFAULT_DEMO_STATE,
    refillStatus: "pending" as const,
  };
  const declined = transitionDemoState(pending, "decline-refill", "staff");
  assert.equal(declined.ok, true);
  if (!declined.ok) return;
  assert.equal(declined.state.refillStatus, "rejected");

  const requestedAgain = transitionDemoState(
    declined.state,
    "request-refill",
    "patient",
  );
  assert.equal(requestedAgain.ok, true);
  if (!requestedAgain.ok) return;
  assert.equal(requestedAgain.state.refillStatus, "pending");
});

test("roles cannot execute actions assigned to the other portal", () => {
  const patientApproval = transitionDemoState(
    { ...DEFAULT_DEMO_STATE, refillStatus: "pending" },
    "approve-refill",
    "patient",
  );
  assert.equal(patientApproval.ok, false);
  if (patientApproval.ok) return;
  assert.equal(patientApproval.status, 403);

  const staffBooking = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "staff",
  );
  assert.equal(staffBooking.ok, false);
  if (staffBooking.ok) return;
  assert.equal(staffBooking.status, 403);
});

test("patient workflow remains available when staff reviews the refill", () => {
  const booked = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "patient",
    { appointmentTime: "10:30" },
  );
  assert.equal(booked.ok, true);
  if (!booked.ok) return;

  const intake = transitionDemoState(
    booked.state,
    "complete-intake",
    "patient",
  );
  assert.equal(intake.ok, true);
  if (!intake.ok) return;

  const refill = transitionDemoState(
    intake.state,
    "request-refill",
    "patient",
  );
  assert.equal(refill.ok, true);
  if (!refill.ok) return;

  const reviewed = transitionDemoState(
    refill.state,
    "approve-refill",
    "staff",
  );
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  assert.deepEqual(reviewed.state, {
    ...intake.state,
    refillStatus: "approved",
  });
});

test("patient can reschedule, cancel, and book again", () => {
  const booked = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "patient",
    { appointmentTime: "09:00" },
  );
  assert.equal(booked.ok, true);
  if (!booked.ok) return;

  const rescheduled = transitionDemoState(
    booked.state,
    "reschedule-appointment",
    "patient",
    { appointmentTime: "15:00" },
  );
  assert.equal(rescheduled.ok, true);
  if (!rescheduled.ok) return;
  assert.equal(rescheduled.state.appointmentTime, "15:00");

  const cancelled = transitionDemoState(
    rescheduled.state,
    "cancel-appointment",
    "patient",
  );
  assert.equal(cancelled.ok, true);
  if (!cancelled.ok) return;
  assert.equal(cancelled.state.appointmentStatus, "cancelled");
  assert.equal(cancelled.state.appointmentBooked, false);

  const bookedAgain = transitionDemoState(
    cancelled.state,
    "book-appointment",
    "patient",
    { appointmentTime: "10:30" },
  );
  assert.equal(bookedAgain.ok, true);
  if (!bookedAgain.ok) return;
  assert.equal(bookedAgain.state.appointmentStatus, "scheduled");
});

test("staff advances an appointment through the visit lifecycle", () => {
  const scheduled = {
    ...DEFAULT_DEMO_STATE,
    appointmentBooked: true,
    appointmentStatus: "scheduled" as const,
  };
  const checkedIn = transitionDemoState(
    scheduled,
    "check-in-appointment",
    "staff",
  );
  assert.equal(checkedIn.ok, true);
  if (!checkedIn.ok) return;
  assert.equal(checkedIn.state.appointmentStatus, "checked-in");

  const started = transitionDemoState(
    checkedIn.state,
    "start-appointment",
    "staff",
  );
  assert.equal(started.ok, true);
  if (!started.ok) return;
  assert.equal(started.state.appointmentStatus, "in-progress");

  const completed = transitionDemoState(
    started.state,
    "complete-appointment",
    "staff",
  );
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.state.appointmentStatus, "completed");
  assert.equal(completed.state.appointmentBooked, false);
});

test("appointment actions reject invalid payloads and transitions", () => {
  const missingTime = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "patient",
  );
  assert.deepEqual(missingTime, {
    ok: false,
    status: 400,
    error: "Choose an available appointment time.",
  });

  const startWithoutCheckIn = transitionDemoState(
    {
      ...DEFAULT_DEMO_STATE,
      appointmentBooked: true,
      appointmentStatus: "scheduled",
    },
    "start-appointment",
    "staff",
  );
  assert.equal(startWithoutCheckIn.ok, false);
  if (startWithoutCheckIn.ok) return;
  assert.equal(startWithoutCheckIn.status, 409);
});
