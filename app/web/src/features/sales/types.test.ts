import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMoney, decimalMoney, money, localizedSale } from "./types";
test("USD entry never rounds fractional cents or accepts exponent notation", () => {
  assert.equal(parseMoney("79.00"), 7900);
  assert.equal(parseMoney("0,50"), 50);
  assert.equal(parseMoney("999999.99"), 99999999);
  for (const value of [
    "-1",
    "0.49",
    "1e3",
    "79.001",
    "NaN",
    "",
    "1,000.00",
    "1000000",
  ])
    assert.equal(parseMoney(value), null, value);
  assert.equal(decimalMoney(7905), "79.05");
  assert.equal(money(7905, "usd", "en"), "$79.05");
  assert.equal(
    money("900719925474099101", "usd", "en"),
    "$9,007,199,254,740,991.01",
  );
});
test("missing translations retain default content", () => {
  const item = {
    title: "Default",
    description: "Original",
    translations: { ru: { title: "Название", description: "" } },
  };
  assert.equal(localizedSale(item, "uk").title, "Default");
  assert.equal(localizedSale(item, "ru").title, "Название");
  assert.equal(localizedSale(item, "ru").description, "Original");
});
