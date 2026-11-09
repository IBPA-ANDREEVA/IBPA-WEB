import { test } from "node:test";
import assert from "node:assert/strict";
import {
  notificationVisible,
  type NotificationViewer,
} from "./dashboard-notifications";
const viewer: NotificationViewer = {
  clerkId: "clerk-1",
  userId: "user-1",
  email: "member@example.com",
  role: "MEMBER",
};
test("recipient isolation includes members, partners and invited teams without exposing email campaigns", () => {
  const base = {
    type: "DASHBOARD",
    visibility: "TARGETED",
    recipients: { emails: ["Member@Example.com"] },
  };
  assert.equal(notificationVisible(base, viewer), true);
  assert.equal(
    notificationVisible(base, {
      ...viewer,
      userId: "other",
      email: "other@example.com",
    }),
    false,
  );
  assert.equal(notificationVisible({ ...base, type: "EMAIL" }, viewer), false);
  assert.equal(
    notificationVisible(
      { ...base, recipients: { roles: ["PARTNER"] } },
      { ...viewer, role: "PARTNER" },
    ),
    true,
  );
  assert.equal(
    notificationVisible(
      { ...base, recipients: { roles: ["PARTNER"] } },
      viewer,
    ),
    false,
  );
  assert.equal(
    notificationVisible(
      { ...base, recipients: { userIds: ["user-1"] } },
      viewer,
    ),
    true,
  );
  assert.equal(
    notificationVisible(
      { ...base, recipients: { roles: ["TEAM_MEMBER"] } },
      { ...viewer, role: "TEAM_MEMBER" },
    ),
    true,
  );
  assert.equal(
    notificationVisible({ ...base, visibility: "ALL" }, viewer),
    true,
  );
});
