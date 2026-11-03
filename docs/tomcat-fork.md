# Tomcat fork workflow

```text
multica-ai/multica (upstream/main)
          | fetch + merge
          v
feat/tomcat-agent -- validate + push --> teisun/multica (origin)
          ^                                  |
          +------------ fetch + merge --------+
```

Use `feat/tomcat-agent` for the Tomcat integration. The fork's default `main`
branch remains upstream-only; selecting the default branch does not select the
integration. These remotes are independent sources, not automatic synchronization.

Start with a clean working tree on `feat/tomcat-agent`.

## Changes from another machine

```sh
git fetch origin
git merge --ff-only origin/feat/tomcat-agent
```

If both sides have commits, inspect the differences, then use a normal
`git merge origin/feat/tomcat-agent`, resolve conflicts and validate. Do not reset
or force-push to discard either side's work.

## Updates from the source project

```sh
git fetch upstream
git merge upstream/main
# Resolve conflicts and validate before uploading.
git push origin HEAD:refs/heads/feat/tomcat-agent
```

`origin` is `https://github.com/teisun/multica.git`; `upstream` is
`https://github.com/multica-ai/multica.git`. The repository-local push default is
`origin`. Push only the integration branch, not backup references or tags.

## Runtime and database boundaries

- Use an ACP-enabled Tomcat CLI (minimum declared version `0.1.80`); version alone
  is not a capability check. `MULTICA_TOMCAT_PATH` and `MULTICA_TOMCAT_MODEL` select
  the executable and optional model. Tasks require an explicit absolute workspace.
- Runtime instructions and skills use `AGENTS.md` and `.agents/skills`. Existing
  user-authored sidecars must survive task cleanup.
- Back up the existing instance's database, configuration and uploads before
  upgrading. Rehearse migrations on a restored copy; never substitute an empty
  database for the existing instance.
- The Tomcat whitelist migration is now `607_runtime_profile_add_tomcat`, after
  the frozen upstream sequence through `606`. Existing
  `584_runtime_profile_add_tomcat` ledger entries remain intact; the normal runner
  records the new migration separately. The whitelist retains upstream providers,
  including Devin. A down migration preserves old rows but stops accepting new
  Tomcat writes.
- A provider terminal response is not the same as confirmed cleanup. If the
  forwarder cannot acknowledge shutdown within the host's bounded handoff, the
  existing `cleanup_unconfirmed` path preserves the worktree and blocks automatic
  continuation. Check owned processes before manually retrying; do not restart a
  shared Tomcat service as a cleanup shortcut.

This branch targets local source-based development. It does not claim npm,
container-image, GitHub Release, mobile or upstream-PR release readiness. Keep
secrets, backups and private acceptance artifacts out of Git.
