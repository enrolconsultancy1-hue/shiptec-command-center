# Sprint_003 Sprint Plan

## Goal
Implement the Intelligence Layer (Real LLM Integration & Diff Review).

## Scope
- Implement API Key configuration for LLM providers in .env.
- Create a Prompt Engine that converts Builder Specification $\rightarrow$ LLM Prompt.
- Implement a "Proposed Changes" mechanism (returning a diff instead of just a log).
- Add a Review/Approval gate before changes are written to disk.

## Out of Scope
- Multi-model support (will start with one provider).
- Automated test generation by AI (next sprint).
