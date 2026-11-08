| Owner | Update Time | State | Branch | Cov% |
| :--- | :--- | :--- | :--- | :--- |
| Tomcat Agent | 2026-11-08 23:31 +0800 | ACTIVE | feat/tomcat-agent | - |

### DONE

- Extend the existing Tomcat integration fixture to verify that all four custom arguments reach the real ACP/shared-service path before the first prompt. The fixture creates, starts and completes the same saved plan, checks the recorded recommended-answer source, and preserves the existing opt-in and disposable-HOME boundaries.
- Cover host cancellation while waiting for a manual answer through a same-project Native observer using the actual shared-service handshake. Require the pending question before cancellation, its withdrawal afterwards, process cleanup, the original session identity and a still-running private service.
- Add a process-free regression using the actual `session/load`, `-32603`, `session_config_failed` error contract so startup configuration failures do not discard an existing session as a rejected resume.
- Add `tomcat_config.md` as the maintained configuration and handoff guide: genuine Mika, planner and coder roles, custom arguments, original-plan IDs and paths, explicit human approval, attachment snapshots, progress queries, VS Code manual answers, upgrade behavior and scoped verification commands.
- Keep the existing production adapter unchanged: it already passes custom arguments to `tomcat acp`. No new Multica mode parser, database field, settings form, approval service or polling mechanism is introduced.
- This commit preserves the earlier real-model discovery and private-fixture protections already on the branch. It includes the integration test, configuration guide and this status file; the unrelated generated route-type path change in `apps/web/next-env.d.ts` remains unstaged and unmodified.

### INTERFACE

No Multica production interface changes. The guide documents Tomcat's `--mode`, `--plan-review`, `--question-policy` and `--plan-start` settings through the existing per-agent custom-argument field. Ordinary questions default to manual; recommended answers do not authorize implementation or tools. Manual answer cards belong in a same-HOME, same-project VS Code observer, not the Multica task page.

### VERIFICATION

| Scope | Result | Evidence and boundary |
| :--- | :--- | :--- |
| Accepted source snapshot | The integration test, guide and preserved generated file match the accepted hashes | Current preflight `1794151679400-2f39sl`, exit 0; no production changes since acceptance |
| Format, static analysis and error classification | gofmt, `go vet -tags=agentintegration ./pkg/agent` and `TestTomcatSessionConfigFailureDoesNotRejectResume` passed | Current `1794151679528-2ekzb0`, exit 0; the focused test does not launch an agent or access an account |
| Cross-repository fixture | The opt-in `^TestTomcat` integration batch passed in 88.539s using the development Tomcat binary | Reuse `1794147050670-yl7yk6`, exit 0, because relevant source and fixtures are unchanged; local model fixture, not paid-account acceptance |
| Guide examples | Seven Bash blocks, two JSON blocks and three custom-argument arrays passed syntax checks | Reuse `1794146442191-yrgoml`, exit 0; the guide hash is unchanged |
| Desktop and VS Code journeys | Existing manual/recommended planning, approval, original-plan execution and observer evidence retained | Not rerun for this commit; the isolated services remain stopped |

The detailed local evidence remains in the sibling Tomcat checkout under `.agents/acceptance/multica-plan-collaboration/` and `.agents/acceptance/multica-tomcat-remediation/`. Coverage was not measured, so the commit omits a numeric coverage trailer. This is local source delivery, not a push, release, installation or shared-service restart.

### BLOCKED

| Item | Limitation | Boundary |
| :--- | :--- | :--- |
| Platform and release readiness | Windows/Linux/arm64 native acceptance, remote CI and release readiness are not established by these macOS checks | Do not claim whole-workspace, cross-platform or fresh paid-model acceptance |
| Existing environment limitations | Earlier unrelated CLI failures, the un-injected failed-stop branch and retained failed-fixture resources remain documented in the Tomcat evidence | Do not count them as new regressions or silently claim they were resolved |
| Runtime upgrade | Installing a package does not replace an already running Tomcat shared service; explicit executable overrides may still select an older build | No installation, configuration changes or service restart in this commit operation |
