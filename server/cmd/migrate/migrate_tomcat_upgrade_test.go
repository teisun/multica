package main

import (
	"context"
	"math/rand/v2"
	"testing"
	"time"
)

func TestTomcatUpgradePreservesOldMigrationLedgerAndProfiles(t *testing.T) {
	base := openTestPool(t)
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	defer cancel()
	schema := createScratchSchema(t, ctx, base, "migrate_tomcat_")
	pool := openTestPoolWithSearchPath(t, schema)
	if _, err := pool.Exec(ctx, `
 CREATE TABLE runtime_profile (protocol_family text NOT NULL);
 INSERT INTO runtime_profile VALUES ('tomcat');
 CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
 INSERT INTO schema_migrations (version) VALUES ('584_runtime_profile_add_tomcat');
 `); err != nil {
		t.Fatal(err)
	}
	versions := []string{"593_runtime_profile_add_devin", "607_runtime_profile_add_tomcat"}
	options := runOptions{
		Direction: "up", Files: realMigrationFiles(t, versions, "up"),
		SchemaMigrationsTable: schema + ".schema_migrations",
		AdvisoryLockKey:       int64(rand.Uint64()&0x7fffffffffffffff) | 1,
	}
	for pass := 0; pass < 2; pass++ {
		if err := runMigrations(ctx, pool, options); err != nil {
			t.Fatalf("upgrade pass %d: %v", pass, err)
		}
	}
	assertSourceContextMigrationLedger(t, pool, schema, append(versions, "584_runtime_profile_add_tomcat"), true)
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&count); err != nil || count != 3 {
		t.Fatalf("ledger count=%d err=%v", count, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM runtime_profile WHERE protocol_family='tomcat'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("old Tomcat row count=%d err=%v", count, err)
	}
	for _, family := range []string{"devin", "tomcat"} {
		if _, err := pool.Exec(ctx, `INSERT INTO runtime_profile VALUES ($1)`, family); err != nil {
			t.Fatalf("provider %s rejected: %v", family, err)
		}
	}
	if _, err := pool.Exec(ctx, `INSERT INTO runtime_profile VALUES ('unknown-provider')`); err == nil {
		t.Fatal("unknown provider accepted")
	}
}
