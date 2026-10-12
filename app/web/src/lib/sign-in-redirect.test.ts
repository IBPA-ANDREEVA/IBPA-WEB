import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSignInRedirect } from "./sign-in-redirect";

const HOST = "localhost:3001";

describe("resolveSignInRedirect", () => {
  it("defaults to the dashboard when there is no redirect_url", () => {
    assert.equal(resolveSignInRedirect(undefined, HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("", HOST), "/dashboard");
  });

  it("returns to /admin when Clerk sends the absolute admin URL", () => {
    assert.equal(resolveSignInRedirect("http://localhost:3001/admin", HOST), "/admin");
    assert.equal(
      resolveSignInRedirect("http://localhost:3001/admin/members?page=2", HOST),
      "/admin/members?page=2",
    );
  });

  it("returns to /dashboard routes and accepts relative paths", () => {
    assert.equal(resolveSignInRedirect("http://localhost:3001/dashboard/community", HOST), "/dashboard/community");
    assert.equal(resolveSignInRedirect("/admin", HOST), "/admin");
    assert.equal(resolveSignInRedirect(["/admin", "/other"], HOST), "/admin");
  });

  it("rejects other origins and unsafe values", () => {
    assert.equal(resolveSignInRedirect("https://evil.com/admin", HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("//evil.com", HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("/\\evil.com", HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("javascript:alert(1)", HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("http://localhost:3001/admin", null), "/dashboard");
  });

  it("does not redirect back to the sign-in page", () => {
    assert.equal(resolveSignInRedirect("/sign-in", HOST), "/dashboard");
    assert.equal(resolveSignInRedirect("http://localhost:3001/sign-in?x=1", HOST), "/dashboard");
  });
});
