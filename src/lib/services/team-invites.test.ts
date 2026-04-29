import assert from "node:assert/strict";
import test from "node:test";
import {
  SECOND_ORGANIZATION_MESSAGE,
  buildInviteLink,
  canManageOrganizationTeam,
  getInviteAcceptanceError,
  getInviteDisplayStatus,
  hashInviteToken,
} from "./team-invite-utils";

const future = new Date("2026-05-05T12:00:00Z");
const now = new Date("2026-04-28T12:00:00Z");

test("owner and administrator membership roles can manage team invites", () => {
  assert.equal(
    canManageOrganizationTeam({ membershipRole: "owner", permissions: [] }),
    true
  );
  assert.equal(
    canManageOrganizationTeam({
      membershipRole: "administrator",
      permissions: [],
    }),
    true
  );
});

test("lower roles cannot manage team invites even with settings read/write permissions", () => {
  assert.equal(
    canManageOrganizationTeam({
      membershipRole: "security_manager",
      permissions: ["settings.manage"],
    }),
    false
  );
  assert.equal(
    canManageOrganizationTeam({ membershipRole: "security_analyst", permissions: [] }),
    false
  );
  assert.equal(
    canManageOrganizationTeam({ membershipRole: "viewer", permissions: [] }),
    false
  );
});

test("invite status treats pending rows past expiration as expired", () => {
  assert.equal(
    getInviteDisplayStatus({ status: "pending", expiresAt: future }, now),
    "pending"
  );
  assert.equal(
    getInviteDisplayStatus(
      { status: "pending", expiresAt: new Date("2026-04-27T12:00:00Z") },
      now
    ),
    "expired"
  );
  assert.equal(
    getInviteDisplayStatus({ status: "revoked", expiresAt: future }, now),
    "revoked"
  );
});

test("expired or revoked invites cannot be accepted", () => {
  assert.match(
    getInviteAcceptanceError({
      invite: {
        email: "analyst@example.com",
        organizationId: "org-1",
        status: "pending",
        expiresAt: new Date("2026-04-27T12:00:00Z"),
      },
      userEmail: "analyst@example.com",
      activeOrganizationId: null,
      now,
    }) ?? "",
    /expired/i
  );

  assert.match(
    getInviteAcceptanceError({
      invite: {
        email: "analyst@example.com",
        organizationId: "org-1",
        status: "revoked",
        expiresAt: future,
      },
      userEmail: "analyst@example.com",
      activeOrganizationId: null,
      now,
    }) ?? "",
    /revoked/i
  );
});

test("valid invite accepts only the invited email and one organization", () => {
  const invite = {
    email: "analyst@example.com",
    organizationId: "org-1",
    status: "pending",
    expiresAt: future,
  };

  assert.equal(
    getInviteAcceptanceError({
      invite,
      userEmail: "ANALYST@example.com",
      activeOrganizationId: null,
      now,
    }),
    null
  );
  assert.match(
    getInviteAcceptanceError({
      invite,
      userEmail: "other@example.com",
      activeOrganizationId: null,
      now,
    }) ?? "",
    /sent to analyst@example.com/i
  );
  assert.equal(
    getInviteAcceptanceError({
      invite,
      userEmail: "analyst@example.com",
      activeOrganizationId: "org-2",
      now,
    }),
    SECOND_ORGANIZATION_MESSAGE
  );
});

test("invite links contain the raw token while storage uses only a hash", () => {
  const token = "token-123";
  const link = buildInviteLink("https://app.fortexa.test", token);

  assert.equal(link, "https://app.fortexa.test/invite/token-123");
  assert.notEqual(hashInviteToken(token), token);
});
