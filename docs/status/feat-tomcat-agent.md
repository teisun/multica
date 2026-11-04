| Owner | Update Time | State | Branch | Cov% |
| :--- | :--- | :--- | :--- | :--- |
| Tomcat Agent | 2026-11-04 21:47 +0800 | ACTIVE | feat/tomcat-agent | - |

### DONE

- Restore Agent-owned Tomcat integration tests without inheriting the outer Agent marker into the private fixture. The default environment regression checks both direct CLI and registered backend environments with marked and unmarked parents.
- Keep the private HOME when service shutdown fails and report the failure; successful shutdown retains normal cleanup.
- Include both test files in this local commit. The production Tomcat backend, shared service, database and application behavior are unchanged.
- Earlier implementation verification passed: the default environment regression, tagged package vet/format checks, and the opt-in real shared-service test covering registered backend execution, cancellation and same-session resume. Evidence is in the sibling Tomcat checkout under `.agents/acceptance/20261104T110014Z-isolated-tests/`.
- For this commit, inspect staged, unstaged and untracked files and review the complete related diff. Per the user's instruction, do not rerun tests or builds. Coverage was not measured; omit a numeric coverage trailer. Do not push or publish.

### INTERFACE

No public interface changes. Environment factories are test-only; real-agent smoke tests remain explicitly opt-in behind `agentintegration` and `MULTICA_RUN_REAL_AGENT_SMOKE=1`.

### BLOCKED

No local commit blocker. The failed-stop branch was reviewed but not fault-injected; a successful stop is not proof of that failure path. Windows/Linux/arm64 native acceptance, paid model accounts, remote CI and release readiness are not established by the macOS x86_64 checks. Earlier unrelated CLI failures and retained failed-fixture resources remain documented in the Tomcat acceptance evidence rather than being claimed as resolved.
