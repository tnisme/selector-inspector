function getVerdict(score) {
  if (score >= 80) return "Strong locator";
  if (score >= 60) return "Acceptable, could improve";
  if (score >= 40) return "Weak — needs improvement";
  return "Poor — likely to break";
}

function getSeverity(delta) {
  if (delta >= 8) return "good";
  if (delta >= 1) return "ok";
  if (delta === 0) return "warning";
  return "bad";
}

// Pattern 5: require at least one digit in the hex suffix (avoids flagging .color-fadecc etc.)
// Pattern 6: require prefix ≥4 alpha chars to skip short Tailwind/Bootstrap utilities (.col-123, .gap-100)
export function countDynamicTokens(locator) {
  return [
    /\b(?:css|sc|jss|emotion|makeStyles|mui)-[a-zA-Z0-9]{4,}/gi,
    /[#.]\w+__[a-zA-Z0-9]{5,}/g,
    /[#.]\w+-[a-z]+\d+[a-z]+\d+/gi,               // interleaved hash: .btn-a3f9c2
    /[#.]\w+-\d{4,}/g,                              // ≥4 consecutive digits: .item-12345
    /[#.]\w+-(?=[a-f0-9]*\d)[a-f0-9]{6,}/gi,       // hex suffix with ≥1 digit: .card-ab3d5f
    /[#.][a-zA-Z]{4,}-\d{3,}/g,                    // long alpha prefix + ≥3 digits: .component-123
  ].reduce((sum, re) => sum + (locator.match(re) || []).length, 0);
}

// Logarithmic decay: 1→40, 2→25, 3→20, 10→12, 20→9
export function getMatchScore(count) {
  if (count === 0) return 0;
  if (count === 1) return 40;
  return Math.max(0, Math.round(40 / Math.log2(count + 1)));
}

export function measureDepth(locator, type) {
  // Weighted Playwright chain — semantic*0.5, structural*1.0, positional*1.5
  if (type === "playwright") {
    const semantic = (locator.match(/\.getBy\w+\(/g) || []).length;
    const structural = (locator.match(/\.(locator|filter|frameLocator)\(/g) || []).length;
    const positional = (locator.match(/\.(nth|first|last)\(/g) || []).length;
    const weighted = semantic * 0.5 + structural * 1.0 + positional * 1.5;
    return Math.max(1, Math.round(weighted));
  }

  if (type === "xpath") {
    return Math.max(1, locator.split("/").filter((s) => s.trim()).length);
  }

  if (type === "smart") {
    const parts = locator.split(">>");
    return Math.max(...parts.map((p) => measureDepth(p.trim(), "css")));
  }

  const simplified = locator
    .replace(/\([^)]*\)/g, "()")
    .replace(/\[[^\]]*\]/g, "[]");

  const groups = simplified.split(",");
  return Math.max(
    ...groups.map((g) =>
      Math.max(1, g.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean).length)
    )
  );
}

export function analyzeLocator(locator, type) {
  const positionalCount = (
    locator.match(/:nth-(child|of-type|last-child)\(|:first-child\b|:last-child\b/gi) || []
  ).length;
  const hasPositionalIndex = positionalCount > 0;

  const dynamicCount = countDynamicTokens(locator);
  const hasDynamicIdOrClass = dynamicCount > 0;

  const xpathPositionalCount =
    type === "xpath" ? (locator.match(/\[\d+\]/g) || []).length : 0;
  const hasPositionalXPath = xpathPositionalCount > 0;

  const trimmed = locator.trim();

  const hasGlobalXPath =
    type === "xpath" &&
    /^\/\//.test(trimmed) &&
    !/@(data-testid|data-test-id|data-cy|data-qa|data-test|id|role|aria-label|aria-labelledby|name)\b/.test(trimmed);

  // Regex only matches bare tags (^...$) — div.foo, button[type=submit] are not flagged
  const isGenericTag =
    /^(div|span|p|a|button|input|form|ul|ol|li|section|article|header|footer|main|nav)$/i.test(
      trimmed
    );

  const hasContainsText = (() => {
    if (type !== "xpath") return false;
    const m = locator.match(/contains\(text\(\)\s*,\s*["']([^"']+)["']\)/);
    return m ? m[1].length > 30 : false;
  })();

  let semanticScore = 0;
  let semanticLabel = "No semantic anchor";

  if (type === "playwright") {
    if (/getByTestId\(/.test(locator)) {
      semanticScore = 20;
      semanticLabel = "Uses getByTestId()";
    } else if (/getByRole\(|getByLabel\(/.test(locator)) {
      semanticScore = 15;
      semanticLabel = "Uses getByRole/getByLabel()";
    } else if (/getByText\(|getByPlaceholder\(/.test(locator)) {
      semanticScore = 12;
      semanticLabel = "Uses getByText/getByPlaceholder()";
    } else {
      semanticScore = 5;
      semanticLabel = "Basic Playwright locator";
    }
  } else if (type === "xpath") {
    if (/@data-testid|@data-test-id|@data-cy|@data-test\b|@data-qa/.test(locator)) {
      semanticScore = 20;
      semanticLabel = "Uses @data-testid";
    } else if (/@role\b|@aria-label\b|@aria-labelledby\b/.test(locator)) {
      semanticScore = 12;
      semanticLabel = "Uses @aria/role attribute";
    } else if (/@class\b/.test(locator)) {
      semanticScore = 5;
      semanticLabel = "Uses @class only";
    }
  } else {
    if (/data-testid|data-test-id|data-cy|\bdata-test\b|data-qa/.test(locator)) {
      semanticScore = 20;
      semanticLabel = "Uses data-testid attribute";
    } else if (/\[role=|\[aria-label|\[aria-labelledby/.test(locator)) {
      semanticScore = 12;
      semanticLabel = "Uses role/aria attribute";
    } else if (/\.[a-zA-Z][\w-]*/.test(locator)) {
      semanticScore = 5;
      semanticLabel = "Class-based selector";
    }
  }

  const depth = measureDepth(locator, type);

  const attrValueMatches = locator.match(/\[[\w-]+="([^"]+)"\]/g) || [];

  const hasLongAttrValue = attrValueMatches.some((m) => {
    const val = m.match(/"([^"]+)"/)?.[1] || "";
    return val.length > 40;
  });

  const hasContentLikeValue = attrValueMatches.some((m) => {
    const val = m.match(/"([^"]+)"/)?.[1] || "";
    const words = val.split(/\s+/).length;
    return words > 5 || (val.includes(",") && words > 3);
  });

  return {
    positionalCount,
    dynamicCount,
    xpathPositionalCount,
    hasPositionalIndex,
    hasDynamicIdOrClass,
    hasPositionalXPath,
    hasGlobalXPath,
    isGenericTag,
    hasContainsText,
    hasLongAttrValue,
    hasContentLikeValue,
    semanticScore,
    semanticLabel,
    depth,
  };
}

function computeScores(analysis, matchCount, isLive) {
  const {
    positionalCount,
    dynamicCount,
    xpathPositionalCount,
    hasDynamicIdOrClass,
    hasPositionalXPath,
    hasGlobalXPath,
    isGenericTag,
    hasContainsText,
    hasLongAttrValue,
    hasContentLikeValue,
    semanticScore,
    semanticLabel,
    depth,
  } = analysis;

  const breakdown = [];

  // A: match score (live only)
  let matchScore = 0;
  if (isLive) {
    matchScore = getMatchScore(matchCount);
    const matchLabel =
      matchCount === 0
        ? "No elements found"
        : matchCount === 1
        ? "Unique match (1 element)"
        : matchCount === 2
        ? "2 elements matched"
        : matchCount <= 5
        ? `${matchCount} elements matched`
        : matchCount <= 10
        ? `${matchCount} elements (many)`
        : `${matchCount} elements (too many)`;
    breakdown.push({ label: matchLabel, delta: matchScore, category: "match", severity: getSeverity(matchScore), issueType: "match" });
  }

  // B: stability
  const b1 = Math.max(0, 10 - positionalCount * 4);
  const positionalLabel =
    positionalCount === 0
      ? "No positional index"
      : `${positionalCount} positional selector${positionalCount > 1 ? "s" : ""} (:nth-child, etc.)`;
  breakdown.push({ label: positionalLabel, delta: b1, category: "stability", severity: getSeverity(b1), issueType: "positional" });

  // Cap dynamic class penalty when a good semantic anchor is present
  const b2Raw = Math.max(0, 10 - dynamicCount * 5);
  const b2 = semanticScore >= 12 ? Math.max(b2Raw, 5) : b2Raw;
  let dynamicLabel;
  if (dynamicCount === 0) {
    dynamicLabel = "No dynamic ID/class";
  } else {
    const impact = b2 === 0 ? "high impact" : b2 <= 5 ? "moderate impact" : "low impact";
    dynamicLabel = `${dynamicCount} auto-generated pattern${dynamicCount > 1 ? "s" : ""} (${impact})`;
  }
  breakdown.push({ label: dynamicLabel, delta: b2, category: "stability", severity: getSeverity(b2), issueType: "dynamic" });

  const b3 = Math.max(0, 10 - xpathPositionalCount * 4);
  breakdown.push({
    label: hasPositionalXPath
      ? "Positional XPath predicate ([1], [2]…)"
      : "No positional XPath",
    delta: b3,
    category: "stability",
    severity: getSeverity(b3),
    issueType: "xpath_positional",
  });

  if (hasGlobalXPath) {
    breakdown.push({ label: "Global XPath (// without anchor)", delta: -5, category: "stability", severity: "bad", issueType: "global_xpath" });
  }
  if (isGenericTag) {
    breakdown.push({ label: "Generic tag only (no specificity)", delta: -10, category: "stability", severity: "bad", issueType: "generic_tag" });
  }
  if (hasContainsText) {
    breakdown.push({ label: "Long text() match (fragile)", delta: -5, category: "stability", severity: "bad", issueType: "contains_text" });
  }
  if (hasLongAttrValue) {
    breakdown.push({ label: "Long attribute value (>40 chars, fragile)", delta: -10, category: "stability", severity: "bad", issueType: "long_attr_value" });
  }
  if (hasContentLikeValue) {
    breakdown.push({ label: "Selector uses content description (may change)", delta: -5, category: "stability", severity: "bad", issueType: "content_like_value" });
  }

  // Combo penalty: dynamic class without any semantic anchor
  let comboPenalty = 0;
  if (hasDynamicIdOrClass && semanticScore <= 5) {
    comboPenalty = -5;
    breakdown.push({
      label: "Dynamic class without semantic anchor",
      delta: -5,
      category: "stability",
      severity: "bad",
      issueType: "combo",
    });
  }

  // C: semantics
  breakdown.push({ label: semanticLabel, delta: semanticScore, category: "semantics", severity: getSeverity(semanticScore), issueType: "semantics" });

  // D: complexity — gradient (depth 6→-2, 7→-4, …, cap -15)
  let complexity;
  if (depth < 3) {
    complexity = 10;
    breakdown.push({ label: `Depth ${depth} (shallow)`, delta: 10, category: "complexity", severity: "good", issueType: "complexity" });
  } else if (depth <= 5) {
    complexity = 0;
    breakdown.push({ label: `Depth ${depth} (moderate)`, delta: 0, category: "complexity", severity: "warning", issueType: "complexity" });
  } else {
    complexity = Math.max(-15, -((depth - 5) * 2));
    breakdown.push({ label: `Depth ${depth} (deep)`, delta: complexity, category: "complexity", severity: "bad", issueType: "complexity" });
  }

  const stabilityScore =
    b1 + b2 + b3 +
    (hasGlobalXPath ? -5 : 0) +
    (isGenericTag ? -10 : 0) +
    (hasContainsText ? -5 : 0) +
    comboPenalty +
    (hasLongAttrValue ? -10 : 0) +
    (hasContentLikeValue ? -5 : 0);

  // Static raw range calculation:
  // stability: b1[0,10] + b2[0,10] + b3[0,10] + globalXPath[0,-5] + genericTag[0,-10]
  //          + containsText[0,-5] + combo[0,-5] + longAttr[0,-10] + contentLike[0,-5] = [-40, 30]
  // semantic: [0, 20]
  // complexity: [-15, 10]
  // Total: [-55, 60]
  const RAW_MIN = -55;
  const RAW_MAX = 60;
  const staticRaw = stabilityScore + semanticScore + complexity;
  const staticScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(((staticRaw - RAW_MIN) * 100) / (RAW_MAX - RAW_MIN))
    )
  );

  if (!isLive) {
    return { score: staticScore, breakdown, summary: buildSummary(breakdown, null, false), verdict: getVerdict(staticScore) };
  }

  if (matchCount === 0) {
    return { score: 0, staticScore, liveScore: 0, breakdown, confidence: "broken", summary: buildSummary(breakdown, 0, true), verdict: "Poor — likely to break" };
  }

  // Cross-signal penalty scales with matchCount: 2→-8, 5→-12, 10+→-15 (capped)
  let crossSignalPenalty = 0;
  if (matchCount > 1 && semanticScore >= 12) {
    crossSignalPenalty = -Math.min(15, Math.round(5 + Math.log2(matchCount) * 3));
    breakdown.push({
      label: `Semantic anchor matched ${matchCount} elements`,
      delta: crossSignalPenalty,
      category: "semantics",
      severity: "bad",
      issueType: "cross_signal",
    });
  }

  const liveScore = Math.max(
    0,
    Math.min(100, matchScore + stabilityScore + semanticScore + complexity + crossSignalPenalty)
  );
  let finalScore = Math.round(staticScore * 0.4 + liveScore * 0.6);

  // Tiered cap: more matches = lower ceiling
  if      (matchCount === 2)               finalScore = Math.min(finalScore, 70);
  else if (matchCount >= 3 && matchCount <= 5)  finalScore = Math.min(finalScore, 60);
  else if (matchCount >= 6 && matchCount <= 10) finalScore = Math.min(finalScore, 50);
  else if (matchCount > 10)                finalScore = Math.min(finalScore, 40);

  return {
    score: Math.max(0, finalScore),
    staticScore,
    liveScore,
    breakdown,
    confidence: "verified",
    summary: buildSummary(breakdown, matchCount, true),
    verdict: getVerdict(Math.max(0, finalScore)),
  };
}

// One-line diagnosis of the worst issue(s).
// Filter: items that are "bad", or "warning" but not the neutral complexity-moderate item.
function buildSummary(breakdown, matchCount, isLive) {
  if (isLive && matchCount === 0) return "Locator does not match any element";

  const issues = breakdown.filter(
    (b) => b.severity === "bad" || (b.severity === "warning" && b.issueType !== "complexity")
  );

  if (issues.length === 0) return "No major issues detected";

  issues.sort((a, b) => a.delta - b.delta);
  const worst = issues[0];

  if (issues.length >= 2 && issues[1].delta <= 0) {
    return `Main issues: ${worst.label} + ${issues[1].label}`;
  }
  return `Main issue: ${worst.label}`;
}

// Suggestions sorted by priority — match issues first, then structural, then polish.
// issueType-driven so label changes never break suggestion mapping.
function buildSuggestions(matchCount, breakdown) {
  const collected = [];

  if (matchCount !== null && matchCount === 0) {
    collected.push({
      text: "No elements found — verify the selector syntax or try a different locator strategy",
      priority: 0,
    });
  } else if (matchCount !== null && matchCount > 1) {
    collected.push({
      text: `Matches ${matchCount} elements — narrow with [data-testid], [aria-label], or :nth-child as last resort`,
      priority: 0,
    });
  }

  const suggestionByType = {
    positional:       { text: "Replace positional selectors (:nth-child) with [data-testid] or [aria-label]", priority: 2 },
    dynamic:          { text: "Avoid auto-generated classes — use data-testid or role attributes instead", priority: 2 },
    xpath_positional: { text: "Replace [N] predicates with attribute anchors like @data-testid", priority: 2 },
    global_xpath:     { text: "Anchor the XPath — use //*[@data-testid='...'] instead of //tag", priority: 2 },
    generic_tag:      { text: "Add specificity — combine tag with [data-testid], class, or attribute", priority: 1 },
    contains_text:    { text: "Shorten text() match or replace with data-testid", priority: 3 },
    combo:            { text: "Locator uses dynamic class without semantic anchor — add data-testid", priority: 1 },
    cross_signal:     { text: "Semantic anchor matches multiple elements — verify the attribute value is unique", priority: 1 },
    complexity:       { text: "Selector is too deep — anchor closer to the target element", priority: 3 },
    long_attr_value:  { text: "Locator uses a long attribute value (>40 chars) — replace with a shorter, stable attribute like data-testid or class", priority: 1 },
    content_like_value: { text: "Selector relies on content description that may change — use a stable identifier instead", priority: 1 },
  };

  const semanticItem = breakdown.find((b) => b.issueType === "semantics");
  if (semanticItem && semanticItem.delta <= 5) {
    collected.push({ text: "Add data-testid for a stable, intent-revealing locator", priority: 1 });
  }

  for (const item of breakdown) {
    const mapped = suggestionByType[item.issueType];
    if (!mapped) continue;
    const triggered =
      item.severity === "bad" ||
      (item.severity === "warning" && item.issueType !== "complexity");
    if (triggered) collected.push(mapped);
  }

  const seen = new Set();
  return collected
    .filter((s) => (seen.has(s.text) ? false : seen.add(s.text)))
    .sort((a, b) => a.priority - b.priority)
    .map((s) => s.text);
}

export function scoreStatic(locator, type) {
  const analysis = analyzeLocator(locator, type);
  const { score, breakdown, summary, verdict } = computeScores(analysis, null, false);
  const suggestions = buildSuggestions(null, breakdown);
  return { score, breakdown, suggestions, confidence: "preview", summary, verdict };
}

export function scoreLive(locator, type, matchCount, elements) {
  const analysis = analyzeLocator(locator, type);
  const { score, staticScore, liveScore, breakdown, confidence, summary, verdict } =
    computeScores(analysis, matchCount, true);
  const suggestions = buildSuggestions(matchCount, breakdown);
  return { score, staticScore, liveScore, breakdown, suggestions, confidence, summary, verdict };
}
