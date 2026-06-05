import assert from "node:assert/strict";
import { test } from "node:test";
import { assertConnectorCallable, registerConnectorImport, type ConnectorManifest } from "../src/index.ts";

const importedConnector: ConnectorManifest = {
  id: "telegram-demo",
  kind: "im",
  lifecycle: "active",
  tool_contracts: ["tool-request.schema.json"],
  secret_refs: ["vault://telegram/demo"],
  can_send_external_messages: true,
  can_export_data: true
};

test("connector imports do not inherit trust", () => {
  const registration = registerConnectorImport(importedConnector);
  assert.equal(registration.manifest.lifecycle, "quarantined");
  assert.equal(registration.quarantine_required, true);
  assert.equal(registration.policy_required_for_calls, true);
  assert.equal(registration.trust_inherited, false);
});

test("connector callable check rejects non-vault secret refs", () => {
  assert.throws(() => assertConnectorCallable({
    ...importedConnector,
    lifecycle: "active",
    secret_refs: ["plaintext-token"]
  }), /non-vault secret/);
});
