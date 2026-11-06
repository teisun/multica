| Owner | Update Time | State | Branch | Cov% |
| :--- | :--- | :--- | :--- | :--- |
| Tomcat Agent | 2026-11-06 17:40 +0800 | ACTIVE | feat/tomcat-agent | - |

### DONE

- Read the real model catalog through the adapter instead of returning an empty one. `discoverTomcatModels` runs the runtime-bound command as `serve models` with the same identity used for ACP execution, consumes only the stable `ListModelsPayload` fields, hides models whose saved credentials are missing, and reports invalid payloads, duplicate entries, timeouts and zero usable models as errors. Reusing the existing daemon `failed`/`error` path keeps messages on the create-page affordance, with no new protocol, toast, page or daemon production branch.
- No discovery memo for Tomcat: an explicit refresh must observe newly saved credentials immediately, so this branch bypasses the shared discovery cache; caches of other runtimes are untouched.
- Production changes stay inside the Tomcat adapter. `server/pkg/agent/models.go` only switches the `tomcat` case to the new function, and `server/pkg/agent/tomcat_models.go` is new. The remaining changes are tests covering the adapter, the daemon report and the browser journey; the earlier registration work in `agent.go`, `launch.go` and `version.go` was already committed.
- Include the production file, four test files and this status update in one commit. Per the user's instruction, do not rerun tests, builds or type checks. Coverage was not measured; omit a numeric coverage trailer.
- Restore Agent-owned Tomcat integration tests without inheriting the outer Agent marker into the private fixture. The default environment regression checks both direct CLI and registered backend environments with marked and unmarked parents.
- Keep the private HOME when service shutdown fails and report the failure; successful shutdown retains normal cleanup.
- Include both test files in this local commit. The production Tomcat backend, shared service, database and application behavior are unchanged.
- Earlier implementation verification passed: the default environment regression, tagged package vet/format checks, and the opt-in real shared-service test covering registered backend execution, cancellation and same-session resume. Evidence is in the sibling Tomcat checkout under `.agents/acceptance/20261104T110014Z-isolated-tests/`.
- For that earlier commit, staged, unstaged and untracked files were inspected and the complete related diff reviewed. Per the user's instruction, tests and builds were not rerun; coverage was not measured, so omit a numeric coverage trailer.

### INTERFACE

No public interface changes. Environment factories are test-only; real-agent smoke tests remain explicitly opt-in behind `agentintegration` and `MULTICA_RUN_REAL_AGENT_SMOKE=1`.

### BLOCKED

No local commit blocker. The failed-stop branch was reviewed but not fault-injected; a successful stop is not proof of that failure path. Windows/Linux/arm64 native acceptance, paid model accounts, remote CI and release readiness are not established by the macOS x86_64 checks. Earlier unrelated CLI failures and retained failed-fixture resources remain documented in the Tomcat acceptance evidence rather than being claimed as resolved.
