import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommerceButton, CommerceView, CommerceViewSwitch } from "./CommerceUi";

describe("commerce interaction controls", () => {
  it("does not submit the sale or notification form from utility actions", () => {
    const markup = renderToStaticMarkup(
      createElement(CommerceButton, null, "Preview"),
    );
    assert.match(markup, /type="button"/);
    assert.doesNotMatch(markup, /disabled=""/);
    const submit = renderToStaticMarkup(
      createElement(CommerceButton, { type: "submit" }, "Save"),
    );
    assert.match(submit, /type="submit"/);
  });

  it("prevents repeat submission while keeping the busy action named", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CommerceButton,
        { busy: true, type: "submit" },
        "Continue to Stripe",
      ),
    );
    assert.match(markup, /disabled=""/);
    assert.match(markup, /aria-busy="true"/);
    assert.match(markup, /Continue to Stripe/);
    assert.doesNotMatch(
      markup,
      /class="invisible"|aria-hidden="true">Continue/,
    );
  });

  it("preserves link semantics for navigation and exposes the selected view", () => {
    const link = renderToStaticMarkup(
      createElement(
        CommerceButton,
        { asChild: true },
        createElement("a", { href: "/dashboard/sales" }, "Sales"),
      ),
    );
    assert.match(link, /<a /);
    assert.doesNotMatch(link, /<button/);
    const nav = renderToStaticMarkup(
      createElement(CommerceViewSwitch, {
        value: "purchases",
        onChange: () => {},
        label: "Sales",
        options: [
          { value: "", label: "Available items" },
          { value: "purchases", label: "My purchases" },
        ],
      }),
    );
    assert.equal(nav.match(/aria-pressed="true"/g)?.length, 1);
    assert.match(nav, /aria-pressed="false"/);
    assert.match(nav, /<nav aria-label="Sales"/);
  });

  it("renders useful content without browser animation APIs during SSR", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CommerceView,
        { viewKey: "catalog" },
        createElement("p", null, "Available items"),
      ),
    );
    assert.match(markup, /Available items/);
    assert.doesNotMatch(markup, /opacity:0|visibility:hidden/);
  });
});
