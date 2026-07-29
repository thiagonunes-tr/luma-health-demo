import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DEMO_STATE,
  isDemoStateAction,
  transitionDemoState,
} from "../lib/demo-state";

test("recognizes only supported demo actions", () => {
  assert.equal(isDemoStateAction("book-appointment"), true);
  assert.equal(isDemoStateAction("decline-refill"), true);
  assert.equal(isDemoStateAction("overwrite-state"), false);
  assert.equal(isDemoStateAction(null), false);
});

test("patient actions update only their intended field", () => {
  const booked = transitionDemoState(
    DEFAULT_DEMO_STATE,
    "book-appointment",
    "patient",
  );
  assert.equal(booked.ok, true);
  if (!booked.ok) return;
  assert.deepEqual(booked.state, {
    appointmentBooked: true,
    intakeComplete: false,
    refillStatus: "none",
  });

  const intake = transitionDemoState(
    booked.state,
    "complete-intake",
    "patient",
  );
  assert.equal(intake.ok, true);
  if (!intake.ok) return;
  assert.deepEqual(intake.state, {
    appointmentBooked: true,
    intakeComplete: true,
    refillStatus: "none",
  });
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
    appointmentBooked: true,
    intakeComplete: true,
    refillStatus: "approved",
  });
});
