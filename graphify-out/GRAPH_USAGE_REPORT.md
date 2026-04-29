# How to Use the FORTEXA Graph in Future Prompts

This graph is a persistent map of the FORTEXA codebase. Instead of asking an AI to reread the whole project every time, point it at `graphify-out/graph.json` and ask it to answer through the graph first.

## Key Files

- `graph.html`: interactive visual map you can open in a browser.
- `graph.json`: raw graph data for GraphRAG-style prompts and tooling.
- `GRAPH_REPORT.md`: audit report with god nodes, surprising connections, communities, and suggested questions.
- `cost.json`: cumulative extraction/token record.

## Good Prompt Patterns

Use prompts that ask for graph traversal, not just summary:

```text
Use /Users/abdelhak/Documents/PFE/FORTEXA/graphify-out/graph.json first.
Trace how scan imports connect to asset vulnerabilities and remediation tasks.
Use node names, edge confidence, and source files from the graph.
```

```text
Before editing this feature, query the FORTEXA graph for related nodes around
"AI Enrichment Flow", "Trust Panel", and "Asset Vulnerability Detail View".
Then explain the affected files and likely risks.
```

```text
Find the shortest conceptual path between "Nessus Importer" and "Trust Metadata"
using the FORTEXA graph. Only use graph-backed relationships.
```

```text
Use the graph to identify the highest-degree modules related to authentication
or permissions, then inspect only those files before proposing a change.
```

## When to Use It

Use the graph before architecture questions, onboarding questions, refactors, feature planning, bug triage, and impact analysis. It is especially useful when you want to know "what touches this?", "why was this designed this way?", or "which files should I inspect first?"

## How to Keep It Fresh

After code changes, rerun graphify in update mode from the project root:

```bash
cd /Users/abdelhak/Documents/PFE/FORTEXA
/graphify . --update
```

For code-only changes, graphify can update mostly from AST structure. If you add or change docs, design notes, screenshots, or other semantic files, rerun the update so those concepts are re-extracted too.

## How to Read the Graph Honestly

Edges marked `EXTRACTED` came directly from code or docs. Edges marked `INFERRED` are useful hypotheses, but check the source files before making high-risk changes. Edges marked `AMBIGUOUS` should be treated as leads, not facts.
