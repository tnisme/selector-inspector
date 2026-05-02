import assert from "node:assert/strict";
import {
  scoreStatic,
  scoreLive,
  measureDepth,
  analyzeLocator,
  getMatchScore,
  countDynamicTokens,
} from "./locatorScorer.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

// ─── Depth uses min across matched elements ──────────────────────────────────
console.log("Depth — min across matched elements");

test("min depth selected from [8, 2, 15]", () => {
  const r = scoreLive("div.foo", "css", 3, [
    { domDepth: 8 }, { domDepth: 2 }, { domDepth: 15 },
  ]);
  const c = r.breakdown.find((b) => b.category === "complexity");
  assert(c.label.includes("2"), `expected depth 2 in label, got: ${c.label}`);
});

test("min depth → shallow label", () => {
  const r = scoreLive("div.foo", "css", 3, [
    { domDepth: 8 }, { domDepth: 2 }, { domDepth: 15 },
  ]);
  const c = r.breakdown.find((b) => b.category === "complexity");
  assert(c.label.includes("shallow"), `expected shallow, got: ${c.label}`);
});

test("undefined domDepth values are filtered", () => {
  const r = scoreLive("div.foo", "css", 2, [
    { domDepth: undefined }, { domDepth: 4 },
  ]);
  const c = r.breakdown.find((b) => b.category === "complexity");
  assert(c.label.includes("4"), `expected depth 4, got: ${c.label}`);
});

// ─── Logarithmic match scoring ────────────────────────────────────────────────
console.log("\nMatch scoring — logarithmic decay");

test("count=0 → 0", () => assert.equal(getMatchScore(0), 0));
test("count=1 → 40", () => assert.equal(getMatchScore(1), 40));
test("count=2 → 25", () => assert.equal(getMatchScore(2), 25));
test("count=3 → 20", () => assert.equal(getMatchScore(3), 20));
test("count=5 → 15", () => assert.equal(getMatchScore(5), 15));
test("count=10 → 12", () => assert.equal(getMatchScore(10), 12));
test("count=20 → 9", () => assert.equal(getMatchScore(20), 9));
test("count=50 → 7", () => assert.equal(getMatchScore(50), 7));

// ─── Fix 1 (this task): dynamic regex — tighter Tailwind/Bootstrap rules ─────
console.log("\nFix 1 — dynamic regex: Tailwind/Bootstrap false positives");

test(".col-123 → 0 (3-char prefix)", () => assert.equal(countDynamicTokens(".col-123"), 0));
test(".mt-24 → 0", () => assert.equal(countDynamicTokens(".mt-24"), 0));
test(".p-16 → 0", () => assert.equal(countDynamicTokens(".p-16"), 0));
test(".gap-100 → 0", () => assert.equal(countDynamicTokens(".gap-100"), 0));
test(".z-100 → 0", () => assert.equal(countDynamicTokens(".z-100"), 0));
test(".grid-2xl → 0 (no digits in suffix)", () => assert.equal(countDynamicTokens(".grid-2xl"), 0));
test(".theme-default → 0 (no digits in hex-like suffix)", () => assert.equal(countDynamicTokens(".theme-default"), 0));
test(".button-primary → 0", () => assert.equal(countDynamicTokens(".button-primary"), 0));
test(".user-profile-card → 0", () => assert.equal(countDynamicTokens(".user-profile-card"), 0));
test(".component-1234 → ≥1 (long alpha prefix + ≥3 digits)", () => assert(countDynamicTokens(".component-1234") >= 1));
test(".styles-567 → ≥1 (long alpha prefix + 3 digits)", () => assert(countDynamicTokens(".styles-567") >= 1));
test(".css-1a2b3c → ≥1 (CSS-in-JS prefix)", () => assert(countDynamicTokens(".css-1a2b3c") >= 1));
test(".btn-a3f9c2 → ≥1 (interleaved hash)", () => assert(countDynamicTokens(".btn-a3f9c2") >= 1));
test(".sc-bdnxv7 → ≥1 (sc- prefix)", () => assert(countDynamicTokens(".sc-bdnxv7") >= 1));
test(".item-12345 → ≥1 (≥4 consecutive digits)", () => assert(countDynamicTokens(".item-12345") >= 1));
test(".card-ab3d5f → ≥1 (hex with digit)", () => assert(countDynamicTokens(".card-ab3d5f") >= 1));
test(".jss-xYzW12 → ≥1 (jss prefix)", () => assert(countDynamicTokens(".jss-xYzW12") >= 1));
test(".btn__a3f9c2 → ≥1 (CSS modules __)", () => assert(countDynamicTokens(".btn__a3f9c2") >= 1));

// ─── Dynamic class penalty cap when semantic anchor present ───────────────────
console.log("\nDynamic class — penalty reduced with semantic anchor");

test("[data-testid] + dynamic class → b2 delta ≥ 5", () => {
  const r = scoreStatic("[data-testid='foo'].css-abc123", "css");
  const b2 = r.breakdown.find((b) => b.issueType === "dynamic");
  assert(b2 !== undefined, "dynamic item not found");
  assert(b2.delta >= 5, `expected b2.delta >= 5, got ${b2.delta}`);
});

test("dynamic class without semantic → b2 delta can drop to 0", () => {
  const r = scoreStatic(".css-1a2b3c", "css");
  const b2 = r.breakdown.find((b) => b.issueType === "dynamic");
  assert(b2 !== undefined, "dynamic item not found");
  assert(b2.delta <= 5, `expected b2.delta <= 5, got ${b2.delta}`);
});

// ─── staticScore always in [0,100] ───────────────────────────────────────────
console.log("\nRAW_MIN/RAW_MAX — staticScore in [0,100]");

test("worst-case locator → score ≥ 0", () => {
  const r = scoreStatic(
    "//div[contains(text(),'this is a very long text content that exceeds thirty chars')]",
    "xpath"
  );
  assert(r.score >= 0, `score ${r.score} < 0`);
});

test("best-case locator → score ≤ 100", () => {
  const r = scoreStatic("[data-testid='submit-btn']", "css");
  assert(r.score <= 100 && r.score >= 0);
});

// ─── Depth gradient penalty ───────────────────────────────────────────────────
console.log("\nDepth gradient penalty");

test("depth 1 → complexity delta = 10", () => {
  const c = scoreStatic("div.foo", "css").breakdown.find((b) => b.category === "complexity");
  assert.equal(c.delta, 10);
});

test("depth 3 → complexity delta = 0", () => {
  const c = scoreStatic("a > b > c", "css").breakdown.find((b) => b.category === "complexity");
  assert.equal(c.delta, 0);
});

test("depth 6 → complexity delta = -2", () => {
  const c = scoreStatic("a > b > c > d > e > f", "css").breakdown.find((b) => b.category === "complexity");
  assert.equal(c.delta, -2);
});

test("depth 15 → complexity delta = -15 (capped)", () => {
  const c = scoreStatic("a > " + "b > ".repeat(13) + "c > d", "css").breakdown.find((b) => b.category === "complexity");
  assert.equal(c.delta, -15);
});

test("depth 15 penalised more than depth 6", () => {
  const d6 = scoreStatic("a > b > c > d > e > f", "css").breakdown.find((b) => b.category === "complexity").delta;
  const d15 = scoreStatic("a > " + "b > ".repeat(13) + "c > d", "css").breakdown.find((b) => b.category === "complexity").delta;
  assert(d15 < d6, `expected d15(${d15}) < d6(${d6})`);
});

// ─── Fix 4 (this task): cross-signal penalty scales with matchCount ──────────
console.log("\nFix 4 — cross-signal penalty scales with matchCount");

test("matchCount=2, semanticScore=20 → penalty = -8", () => {
  const r = scoreLive("[data-testid='btn']", "css", 2, []);
  const item = r.breakdown.find((b) => b.issueType === "cross_signal");
  assert(item !== undefined, "cross-signal item missing");
  assert.equal(item.delta, -8);
});

test("matchCount=10, semanticScore=20 → penalty = -15 (capped)", () => {
  const r = scoreLive("[data-testid='btn']", "css", 10, []);
  const item = r.breakdown.find((b) => b.issueType === "cross_signal");
  assert(item !== undefined, "cross-signal item missing");
  assert.equal(item.delta, -15);
});

test("10 matches penalised harder than 2 matches", () => {
  const p2  = scoreLive("[data-testid='btn']", "css", 2, []).breakdown.find((b) => b.issueType === "cross_signal").delta;
  const p10 = scoreLive("[data-testid='btn']", "css", 10, []).breakdown.find((b) => b.issueType === "cross_signal").delta;
  assert(p2 > p10, `expected p2(${p2}) > p10(${p10})`);
});

test("penalty capped at -15", () => {
  const r = scoreLive("[data-testid='btn']", "css", 50, []);
  const item = r.breakdown.find((b) => b.issueType === "cross_signal");
  assert(item.delta >= -15, `penalty ${item.delta} below -15`);
});

test("unique match → no cross-signal item", () => {
  const r = scoreLive("[data-testid='btn']", "css", 1, []);
  assert(r.breakdown.find((b) => b.issueType === "cross_signal") === undefined);
});

test("low semanticScore + multi-match → no cross-signal", () => {
  const r = scoreLive(".btn", "css", 5, []);
  assert(r.breakdown.find((b) => b.issueType === "cross_signal") === undefined);
});

// ─── Combo penalty ────────────────────────────────────────────────────────────
console.log("\nCombo penalty (dynamic class + no semantic anchor)");

test(".css-1a2b3c → combo penalty present with delta -5", () => {
  const r = scoreStatic(".css-1a2b3c", "css");
  const item = r.breakdown.find((b) => b.issueType === "combo");
  assert(item !== undefined, "combo item missing");
  assert.equal(item.delta, -5);
});

test("[data-testid] + dynamic class → no combo penalty", () => {
  const r = scoreStatic("[data-testid='foo'].css-abc123", "css");
  assert(r.breakdown.find((b) => b.issueType === "combo") === undefined);
});

// ─── isGenericTag ─────────────────────────────────────────────────────────────
console.log("\nisGenericTag — bare tags only");

test("div → true", () => assert.equal(analyzeLocator("div", "css").isGenericTag, true));
test("span → true", () => assert.equal(analyzeLocator("span", "css").isGenericTag, true));
test("DIV → true (case insensitive)", () => assert.equal(analyzeLocator("DIV", "css").isGenericTag, true));
test("div.foo → false", () => assert.equal(analyzeLocator("div.foo", "css").isGenericTag, false));
test("button[type=submit] → false", () => assert.equal(analyzeLocator("button[type=submit]", "css").isGenericTag, false));
test("div > span → false", () => assert.equal(analyzeLocator("div > span", "css").isGenericTag, false));

// ─── Global XPath extended exclusions ────────────────────────────────────────
console.log("\nGlobal XPath extended exclusions");

test("//div → true", () => assert.equal(analyzeLocator("//div", "xpath").hasGlobalXPath, true));
test("//div[@class='foo'] → true (class-only)", () => assert.equal(analyzeLocator("//div[@class='foo']", "xpath").hasGlobalXPath, true));
test("//span[contains(text(),'hi')] → true (text-only)", () => assert.equal(analyzeLocator("//span[contains(text(),'hi')]", "xpath").hasGlobalXPath, true));
test("//*[@data-testid='x'] → false", () => assert.equal(analyzeLocator("//*[@data-testid='x']", "xpath").hasGlobalXPath, false));
test("//*[@id='main'] → false", () => assert.equal(analyzeLocator("//*[@id='main']", "xpath").hasGlobalXPath, false));
test("//*[@role='dialog'] → false", () => assert.equal(analyzeLocator("//*[@role='dialog']", "xpath").hasGlobalXPath, false));
test("//button[@aria-label='Close'] → false", () => assert.equal(analyzeLocator("//button[@aria-label='Close']", "xpath").hasGlobalXPath, false));
test("//*[@name='email'] → false", () => assert.equal(analyzeLocator("//*[@name='email']", "xpath").hasGlobalXPath, false));

// ─── Severity field ───────────────────────────────────────────────────────────
console.log("\nSeverity field on breakdown items");

const validSeverities = new Set(["good", "ok", "warning", "bad"]);

test("every scoreStatic item has valid severity", () => {
  for (const b of scoreStatic("[data-testid='foo']", "css").breakdown)
    assert(validSeverities.has(b.severity), `invalid severity "${b.severity}" on: ${b.label}`);
});

test("every scoreLive item has valid severity", () => {
  for (const b of scoreLive("[data-testid='foo']", "css", 3, []).breakdown)
    assert(validSeverities.has(b.severity), `invalid severity "${b.severity}" on: ${b.label}`);
});

test("good semantic anchor → severity 'good'", () => {
  const s = scoreStatic("[data-testid='x']", "css").breakdown.find((b) => b.issueType === "semantics");
  assert.equal(s.severity, "good");
});

test("no semantic anchor → severity 'warning' (delta=0)", () => {
  const s = scoreStatic("form", "css").breakdown.find((b) => b.label === "No semantic anchor");
  assert(s !== undefined, "expected 'No semantic anchor' item");
  assert.equal(s.severity, "warning");
});

// ─── Fix 3 (this task): dynamic label shows impact level ─────────────────────
console.log("\nFix 3 — dynamic label with impact level");

test("dynamicCount=0 → 'No dynamic ID/class'", () => {
  const r = scoreStatic("[data-testid='x']", "css");
  const d = r.breakdown.find((b) => b.issueType === "dynamic");
  assert.equal(d.label, "No dynamic ID/class");
});

test("dynamicCount=1, no semantic → 'moderate impact'", () => {
  // .sc-bdnxv7 hits only pattern 1 (sc- prefix), no other pattern fires
  const r = scoreStatic(".sc-bdnxv7", "css");
  const d = r.breakdown.find((b) => b.issueType === "dynamic");
  assert(d.label.includes("moderate impact"), `got: ${d.label}`);
});

test("dynamicCount=2, no semantic → 'high impact'", () => {
  const r = scoreStatic(".css-1a2b3c .emotion-xyz123", "css");
  const d = r.breakdown.find((b) => b.issueType === "dynamic");
  assert(d.label.includes("high impact"), `got: ${d.label}`);
});

test("dynamicCount ≥ 1 → label includes 'impact'", () => {
  const r = scoreStatic(".css-1a2b3c.emotion-xyz123", "css");
  const d = r.breakdown.find((b) => b.issueType === "dynamic");
  assert(d.label.includes("impact"), `got: ${d.label}`);
});

// ─── Fix 5 (this task): issueType on every breakdown item ────────────────────
console.log("\nFix 5 — issueType on every breakdown item");

test("scoreStatic — every item has issueType", () => {
  for (const b of scoreStatic("div", "css").breakdown)
    assert(b.issueType !== undefined, `missing issueType on: ${b.label}`);
});

test("scoreLive — every item has issueType", () => {
  for (const b of scoreLive("[data-testid='btn']", "css", 3, []).breakdown)
    assert(b.issueType !== undefined, `missing issueType on: ${b.label}`);
});

test("positional item has issueType 'positional'", () => {
  const r = scoreStatic("ul > li:nth-child(2)", "css");
  const item = r.breakdown.find((b) => b.issueType === "positional" && r.breakdown.indexOf(b) === r.breakdown.findIndex((x) => x.issueType === "positional"));
  assert(item !== undefined);
});

test("global_xpath issueType fires correctly", () => {
  const r = scoreStatic("//div", "xpath");
  assert(r.breakdown.find((b) => b.issueType === "global_xpath") !== undefined);
});

test("cross_signal issueType fires on multi-match with high semantic", () => {
  const r = scoreLive("[data-testid='btn']", "css", 3, []);
  assert(r.breakdown.find((b) => b.issueType === "cross_signal") !== undefined);
});

// ─── Fix 5: suggestions use issueType (not label parsing) ────────────────────
console.log("\nFix 5 — suggestions via issueType");

test("matchCount=0 → 'No elements found' suggestion", () => {
  assert(scoreLive(".foo", "css", 0, []).suggestions.some((s) => s.includes("No elements found")));
});

test("matchCount>1 → narrow suggestion", () => {
  assert(scoreLive(".foo", "css", 5, []).suggestions.some((s) => s.includes("Matches")));
});

test("global XPath → anchor suggestion", () => {
  assert(scoreStatic("//div", "xpath").suggestions.some((s) => s.includes("Anchor the XPath")));
});

test("generic tag → specificity suggestion", () => {
  assert(scoreStatic("div", "css").suggestions.some((s) => s.includes("Add specificity")));
});

test("deep selector (depth>5) → 'too deep' suggestion", () => {
  assert(scoreStatic("a > b > c > d > e > f > g", "css").suggestions.some((s) => s.includes("too deep")));
});

test("moderate depth (depth=4) → NO 'too deep' suggestion", () => {
  assert(!scoreStatic("a > b > c > d", "css").suggestions.some((s) => s.includes("too deep")));
});

test("combo penalty → combo suggestion", () => {
  assert(scoreStatic(".css-1a2b3c", "css").suggestions.some((s) => s.includes("dynamic class without semantic")));
});

test("cross-signal → unique value suggestion", () => {
  assert(scoreLive("[data-testid='btn']", "css", 3, []).suggestions.some((s) => s.includes("unique")));
});

test("class-only selector (semanticScore=5) → 'Add data-testid' suggestion", () => {
  assert(scoreStatic(".btn", "css").suggestions.some((s) => s.includes("data-testid")));
});

test("no semantic anchor (semanticScore=0) → 'Add data-testid' suggestion", () => {
  assert(scoreStatic("[id='main']", "css").suggestions.some((s) => s.includes("data-testid")));
});

test("suggestions are deduplicated", () => {
  const r = scoreStatic("//div//span", "xpath");
  assert.equal(new Set(r.suggestions).size, r.suggestions.length);
});

// ─── Playwright weighted depth ────────────────────────────────────────────────
console.log("\nPlaywright weighted chain depth");

test("pure getByRole → depth 1", () => assert.equal(measureDepth("page.getByRole('button')", "playwright"), 1));
test("2× getByRole → depth 1", () => assert.equal(measureDepth("page.getByRole('dialog').getByRole('button')", "playwright"), 1));
test("getByRole + locator → depth 2", () => assert.equal(measureDepth("page.getByRole('dialog').locator('.icon')", "playwright"), 2));
test("getByRole + locator + first() → depth 3", () => assert.equal(measureDepth("page.getByRole('dialog').locator('.icon').first()", "playwright"), 3));
test("3× locator + nth() → depth 5", () => assert.equal(measureDepth("page.locator('.a').locator('.b').locator('.c').nth(2)", "playwright"), 5));
test("single locator call → depth 1", () => assert.equal(measureDepth("page.locator('.btn')", "playwright"), 1));

// ─── Contracts ───────────────────────────────────────────────────────────────
console.log("\nContracts");

test("scoreStatic returns { score, breakdown, suggestions, confidence }", () => {
  const r = scoreStatic("[data-testid='x']", "css");
  assert("score" in r && "breakdown" in r && "suggestions" in r && "confidence" in r);
});

test("scoreStatic confidence always 'preview'", () => assert.equal(scoreStatic(".foo", "css").confidence, "preview"));

test("scoreLive with match → confidence 'verified'", () => assert.equal(scoreLive(".foo", "css", 1, []).confidence, "verified"));

test("scoreLive matchCount=0 → confidence 'broken'", () => assert.equal(scoreLive(".foo", "css", 0, []).confidence, "broken"));

test("every breakdown item has { label, delta, category, severity, issueType }", () => {
  for (const b of scoreStatic(".nav > ul > li:nth-child(2)", "css").breakdown)
    assert("label" in b && "delta" in b && "category" in b && "severity" in b && "issueType" in b,
      `incomplete: ${JSON.stringify(b)}`);
});

// ─── Final polish: Fix 1 — tiered match cap ──────────────────────────────────
console.log("\nFinal Fix 1 — tiered match cap");

test("matchCount=2 → score ≤ 70", () => {
  assert(scoreLive("[data-testid='btn']", "css", 2, []).score <= 70);
});
test("matchCount=5 → score ≤ 60", () => {
  assert(scoreLive("[data-testid='btn']", "css", 5, []).score <= 60);
});
test("matchCount=10 → score ≤ 50", () => {
  assert(scoreLive("[data-testid='btn']", "css", 10, []).score <= 50);
});
test("matchCount=50 → score ≤ 40", () => {
  assert(scoreLive("[data-testid='btn']", "css", 50, []).score <= 40);
});
test("2 matches scores higher than 5 matches", () => {
  const m2 = scoreLive("[data-testid='btn']", "css", 2, []).score;
  const m5 = scoreLive("[data-testid='btn']", "css", 5, []).score;
  assert(m2 > m5, `m2=${m2} should > m5=${m5}`);
});
test("5 matches scores higher than 10 matches", () => {
  const m5  = scoreLive("[data-testid='btn']", "css", 5, []).score;
  const m10 = scoreLive("[data-testid='btn']", "css", 10, []).score;
  assert(m5 > m10, `m5=${m5} should > m10=${m10}`);
});
test("10 matches scores higher than 50 matches", () => {
  const m10 = scoreLive("[data-testid='btn']", "css", 10, []).score;
  const m50 = scoreLive("[data-testid='btn']", "css", 50, []).score;
  assert(m10 > m50, `m10=${m10} should > m50=${m50}`);
});

// ─── Final polish: Fix 2 — suggestion priority order ─────────────────────────
console.log("\nFinal Fix 2 — suggestion priority order");

test("generic tag + no semantic: first suggestion is structural (priority 1)", () => {
  const r = scoreStatic("div", "css");
  assert(
    r.suggestions[0].includes("specificity") || r.suggestions[0].includes("data-testid"),
    `first suggestion: "${r.suggestions[0]}"`
  );
});

test("cross-signal: match issue (priority 0) comes before cross-signal (priority 1)", () => {
  const r = scoreLive("[data-testid='btn']", "css", 10, []);
  assert(r.suggestions[0].includes("Matches"), `first: "${r.suggestions[0]}"`);
  assert(r.suggestions[1].includes("verify the attribute"), `second: "${r.suggestions[1]}"`);
});

test("deep selector suggestion (priority 3) comes after semantic suggestion (priority 1)", () => {
  const r = scoreStatic("a > b > c > d > e > f > g", "css");
  const deepIdx = r.suggestions.findIndex((s) => s.includes("too deep"));
  const testidIdx = r.suggestions.findIndex((s) => s.includes("data-testid"));
  if (testidIdx !== -1 && deepIdx !== -1) {
    assert(testidIdx < deepIdx, `testid(${testidIdx}) should come before deep(${deepIdx})`);
  }
});

// ─── Final polish: Fix 3 — summary field ─────────────────────────────────────
console.log("\nFinal Fix 3 — summary field");

test("generic tag → summary mentions 'Generic tag'", () => {
  const r = scoreStatic("div", "css");
  assert(r.summary.includes("Generic tag"), `got: "${r.summary}"`);
});

test("match=0 → summary is exact string", () => {
  const r = scoreLive("#nonexistent", "css", 0, []);
  assert.equal(r.summary, "Locator does not match any element");
});

test("perfect locator → 'No major issues detected'", () => {
  const r = scoreLive("[data-testid='submit']", "css", 1, [{ domDepth: 3 }]);
  assert.equal(r.summary, "No major issues detected");
});

test("div + 15 matches → summary shows two issues", () => {
  const r = scoreLive("div", "css", 15, []);
  assert(r.summary.includes("Main issues:"), `got: "${r.summary}"`);
  assert(r.summary.includes("+"), `got: "${r.summary}"`);
});

test("scoreStatic returns summary field", () => {
  const r = scoreStatic("[data-testid='x']", "css");
  assert("summary" in r, "missing summary field");
  assert(typeof r.summary === "string");
});

test("scoreLive returns summary field", () => {
  const r = scoreLive(".btn", "css", 1, []);
  assert("summary" in r, "missing summary field");
  assert(typeof r.summary === "string");
});

// ─── Verdict ─────────────────────────────────────────────────────────────────
console.log("Verdict label");

test("strong locator → 'Strong locator'", () => {
  const r = scoreLive("[data-testid='submit']", "css", 1, [{ domDepth: 2 }]);
  assert.equal(r.verdict, "Strong locator", `got: "${r.verdict}"`);
});

test("no match → 'Poor — likely to break'", () => {
  const r = scoreLive("#nonexistent", "css", 0, []);
  assert.equal(r.verdict, "Poor — likely to break", `got: "${r.verdict}"`);
});

test("scoreStatic returns verdict as string", () => {
  const r = scoreStatic("[data-testid='foo']", "css");
  assert(typeof r.verdict === "string", "missing verdict field");
});

test("scoreLive returns verdict field", () => {
  const r = scoreLive(".btn", "css", 1, []);
  assert("verdict" in r, "missing verdict field");
  assert(typeof r.verdict === "string");
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
