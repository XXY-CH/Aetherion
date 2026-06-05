export type ConnectorKind = "im" | "mcp" | "oauth" | "saas" | "webhook";

export type ConnectorManifest = {
  id: string;
  kind: ConnectorKind;
  lifecycle: "imported" | "quarantined" | "staged" | "active";
  tool_contracts: string[];
  secret_refs: string[];
  can_send_external_messages: boolean;
  can_export_data: boolean;
};

export type ConnectorRegistration = {
  manifest: ConnectorManifest;
  quarantine_required: boolean;
  policy_required_for_calls: true;
  trust_inherited: false;
};

export function registerConnectorImport(manifest: ConnectorManifest): ConnectorRegistration {
  return {
    manifest: {
      ...manifest,
      lifecycle: manifest.lifecycle === "active" ? "quarantined" : manifest.lifecycle
    },
    quarantine_required: true,
    policy_required_for_calls: true,
    trust_inherited: false
  };
}

export function assertConnectorCallable(manifest: ConnectorManifest): void {
  if (manifest.lifecycle !== "active") {
    throw new Error(`Connector ${manifest.id} is not callable while ${manifest.lifecycle}`);
  }
  if (manifest.secret_refs.some((ref) => !ref.startsWith("vault://"))) {
    throw new Error(`Connector ${manifest.id} contains non-vault secret reference`);
  }
}
