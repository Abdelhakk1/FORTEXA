import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProtectedAreaLiveTokenQuery,
  type LiveScope,
} from "./live-updates";

function flattenSql(query: ReturnType<typeof buildProtectedAreaLiveTokenQuery>) {
  return (query as unknown as { queryChunks: unknown[] }).queryChunks
    .map((chunk) => {
      if (typeof chunk === "string") {
        return "?";
      }

      if (
        chunk &&
        typeof chunk === "object" &&
        "value" in chunk &&
        Array.isArray((chunk as { value: unknown }).value)
      ) {
        return ((chunk as { value: string[] }).value).join("");
      }

      return "";
    })
    .join("");
}

function countOrgParams(query: ReturnType<typeof buildProtectedAreaLiveTokenQuery>) {
  return (query as unknown as { queryChunks: unknown[] }).queryChunks.filter(
    (chunk) => chunk === "org-test"
  ).length;
}

test("protected live-update token queries are organization scoped", () => {
  const scopes: LiveScope[] = [
    "dashboard",
    "assets",
    "vulnerabilities",
    "alerts",
    "remediation",
    "scan-import",
    "reports",
  ];

  for (const scope of scopes) {
    const query = buildProtectedAreaLiveTokenQuery(scope, "org-test");
    const text = flattenSql(query);

    assert.match(text, /organization_id\s*=/);
    assert.ok(countOrgParams(query) > 0, `${scope} should bind organization id`);
  }
});

test("vulnerability live-update tokens scope global CVE tables through org asset vulnerabilities", () => {
  const text = flattenSql(
    buildProtectedAreaLiveTokenQuery("vulnerabilities", "org-test")
  );

  assert.match(text, /from cves c\s+where exists/i);
  assert.match(text, /from cve_enrichments ce\s+where exists/i);
  assert.match(text, /from cve_source_references csr\s+where exists/i);
});
