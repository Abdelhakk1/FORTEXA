import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTeamInviteEmail,
  hasResendEmailConfig,
} from "./resend";

test("resend configuration requires both API key and sender", () => {
  assert.equal(
    hasResendEmailConfig({
      resendApiKey: "re_123",
      fromEmail: "Fortexa <noreply@example.com>",
    }),
    true
  );
  assert.equal(hasResendEmailConfig({ resendApiKey: "re_123" }), false);
  assert.equal(
    hasResendEmailConfig({ fromEmail: "Fortexa <noreply@example.com>" }),
    false
  );
});

test("team invite email includes required Fortexa invite details", () => {
  const email = buildTeamInviteEmail({
    organizationName: "Atlas ATM Security",
    roleLabel: "Security analyst",
    inviteLink: "https://app.fortexa.test/invite/abc",
    expiresAt: new Date("2026-05-05T12:00:00Z"),
  });

  assert.equal(email.subject, "You’ve been invited to Fortexa");
  assert.match(email.text, /Atlas ATM Security/);
  assert.match(email.text, /Security analyst/);
  assert.match(email.text, /https:\/\/app\.fortexa\.test\/invite\/abc/);
  assert.match(email.html, /Accept invite/);
});
