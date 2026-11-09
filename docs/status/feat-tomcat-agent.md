| Owner | Update Time | State | Branch | Cov% |
| :--- | :--- | :--- | :--- | :--- |
| Tomcat Agent | 2026-11-09 10:10 +0800 | ACTIVE | feat/tomcat-agent | - |

### DONE

- Extend the existing Tomcat integration fixture to verify that all four custom arguments reach the real ACP/shared-service path before the first prompt. The fixture creates, starts and completes the same saved plan, checks the recorded recommended-answer source, and preserves the existing opt-in and disposable-HOME boundaries.
- Cover host cancellation while waiting for a manual answer through a same-project Native observer using the actual shared-service handshake. Require the pending question before cancellation, its withdrawal afterwards, process cleanup, the original session identity and a still-running private service.
- Add a process-free regression using the actual `session/load`, `-32603`, `session_config_failed` error contract so startup configuration failures do not discard an existing session as a rejected resume.
- Add `tomcat_config.md` as the maintained configuration and handoff guide: genuine Mika, planner and coder roles, custom arguments, original-plan IDs and paths, explicit human approval, attachment snapshots, progress queries, VS Code manual answers, upgrade behavior and scoped verification commands.
- Fix native Tomcat argument-parse failures being overwritten as `cleanup_unconfirmed`: only a built-in runtime exiting 2 with no stdout, no scan error and no shutdown timeout keeps the original failed/aborted/timeout result. Report the actual executable and `acp --help` check; retain the existing bounded stderr, session reference and cleanup timing. Custom commands and every other uncertain shutdown stay conservative.
- Add a failing-then-passing fake-process regression for native parse failure, custom-profile exit 2, output followed by exit 2 and silent exit 1. Run all existing Tomcat fixtures as built-in runtimes without changing their expected cancellation, timeout, terminal or process-tree behavior.
- Add the single-entry-per-backend guidance to the Tomcat section of `CLI_AND_DAEMON.md`, linking desktop profiles and existing status/stop commands. No automatic duplicate-daemon prevention or recovery mechanism is added.
- Retain the earlier model discovery, integration fixtures and disposable-HOME protections. Current production changes are confined to `server/pkg/agent/tomcat.go`; no mode parser, database field, settings form, approval service or polling mechanism is introduced. The generated route-type path change in `apps/web/next-env.d.ts` remains untouched.

### INTERFACE

No new Multica production interface fields. Native argument rejection now retains the original execution status and identifies the executable instead of claiming uncertain cleanup; custom profiles do not receive that exception. Custom arguments, resume identity, cancellation and cleanup contracts otherwise stay unchanged. The existing guide documents Tomcat's `--mode`, `--plan-review`, `--question-policy` and `--plan-start` through the per-agent custom-argument field. Ordinary questions default to manual; recommended answers do not authorize implementation or tools. Manual answer cards belong in a same-HOME, same-project VS Code observer, not the Multica task page.

### VERIFICATION

| Scope | Result | Evidence and boundary |
| :--- | :--- | :--- |
| Native parse-failure regression | Failed before the fix, then all four cases passed | `1794185535271-a6wedj` red / `1794185709668-qdvnoy` green; `TestTomcatArgumentParseFailure` also asserts session pinning, flags, stderr/path and `taskfailure.Classify` process-failure routing |
| Agent package L1 | `bash scripts/test-go.sh --race --only agent` passed in 574.389s | `1794185854916-6izl5o`, exit 0; covers existing cancellation, 65-second grace/kill, late completion, timeout and resume cases under the default CLI guard |
| Format and whitespace | gofmt produced no filenames; `git diff --check` passed | `1794185883867-a3l3kb`, exit 0; corrects an earlier verification command's wrong working directory, not a product-code failure |
| Single-entry guide | Existing `#start`, status/stop/logs commands and persistent `--profile` flag checked against source | `cmd_daemon.go:46-74,1407-1411`, `main.go:47` and unchanged `tomcat_config.md:123`; no daemon stopped or configuration changed |
| Cross-repository / UI / paid models | Not rerun for this scoped exit-classification fix | No provider wire, daemon, service or UI changes; historical evidence remains in the reports below, not a fresh acceptance claim |

Historical local evidence remains in the sibling Tomcat checkout under `.agents/acceptance/multica-plan-collaboration/` and `.agents/acceptance/multica-tomcat-remediation/`. Coverage was not measured. The user has now authorized a local commit of the adapter fix, its regression tests, the single-entry guide and this branch status. No push, release, installation or shared-service restart is performed; the unrelated generated `apps/web/next-env.d.ts` change remains excluded. Production code, tests, dependencies and runners are unchanged since the checks above, so those valid results are reused without rerunning the full suite. The user previously stopped the redundant `local-tomcat` entry; that recovery is not a new action performed by this change.

### BLOCKED

| Item | Limitation | Boundary |
| :--- | :--- | :--- |
| Platform and release readiness | Windows/Linux/arm64 native acceptance, remote CI and release readiness are not established by these macOS checks | Do not claim whole-workspace, cross-platform or fresh paid-model acceptance |
| Existing environment limitations | Earlier unrelated CLI failures, the un-injected failed-stop branch and retained failed-fixture resources remain documented in the Tomcat evidence | Do not count them as new regressions or silently claim they were resolved |
| Runtime upgrade | Installing a package does not replace an already running Tomcat shared service; explicit executable overrides may still select an older build | No installation, configuration changes or service restart in this source-delivery operation; the original help plan still needs independent review after deployment of the Tomcat cache-key fix |
