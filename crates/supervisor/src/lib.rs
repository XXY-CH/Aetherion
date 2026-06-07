use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct Workspace {
    pub id: String,
    pub root: PathBuf,
    pub ledger_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Ask,
    Deny,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RiskLevel {
    L1,
    L3,
    L5,
}

#[derive(Debug, Clone)]
pub struct ToolRequest {
    pub id: String,
    pub run_id: String,
    pub verb: String,
    pub path: PathBuf,
    pub explicit_user_intent: bool,
}

#[derive(Debug, Clone)]
pub struct ScopedLease {
    pub id: String,
    pub run_id: String,
    pub expires_at_millis: u128,
    pub actions: Vec<String>,
    pub paths: Vec<PathBuf>,
    pub denied: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PolicyDecision {
    pub id: String,
    pub request_id: String,
    pub decision: Decision,
    pub risk_level: RiskLevel,
    pub reason: String,
    pub lease: Option<ScopedLease>,
}

#[derive(Debug, Clone)]
pub struct Consent {
    pub request_id: String,
    pub approved: bool,
}

struct EventHashInput<'a> {
    event_id: &'a str,
    timestamp: &'a str,
    workspace_id: &'a str,
    run_id: &'a str,
    event_type: &'a str,
    summary: &'a str,
    payload_ref: Option<&'a str>,
    parent_event_id: Option<&'a str>,
    parent_event_hash: Option<&'a str>,
}

pub fn init_workspace(root: impl AsRef<Path>, id: impl Into<String>) -> io::Result<Workspace> {
    let root = root.as_ref().to_path_buf();
    let ledger_path = root.join(".aetherion").join("events").join("events.jsonl");
    if let Some(parent) = ledger_path.parent() {
        fs::create_dir_all(parent)?;
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&ledger_path)?;
    Ok(Workspace {
        id: id.into(),
        root,
        ledger_path,
    })
}

pub fn write_workspace_registry(workspace: &Workspace) -> io::Result<PathBuf> {
    let registry_path = workspace.root.join(".aetherion").join("workspace.json");
    let runtime_dir = workspace.root.join(".aetherion");
    if registry_path.exists() {
        let existing = fs::read_to_string(&registry_path)?;
        let existing_id = json_string_field(&existing, "id");
        let existing_root = json_string_field(&existing, "root");
        let workspace_root = workspace.root.to_string_lossy();
        if existing_id.as_deref() == Some(&workspace.id)
            && existing_root.as_deref() == Some(workspace_root.as_ref())
        {
            return Ok(registry_path);
        }
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "workspace registry identity mismatch",
        ));
    }
    fs::write(
        &registry_path,
        format!(
            "{{\n  \"id\": \"{}\",\n  \"root\": \"{}\",\n  \"created_at\": \"unix-ms-{}\",\n  \"authority\": \"rust-supervisor\",\n  \"runtime_dir\": \"{}\",\n  \"ledger_path\": \"{}\"\n}}\n",
            escape_json(&workspace.id),
            escape_json(&workspace.root.display().to_string()),
            now_millis(),
            escape_json(&runtime_dir.display().to_string()),
            escape_json(&workspace.ledger_path.display().to_string())
        ),
    )?;
    Ok(registry_path)
}

pub fn append_event(
    workspace: &Workspace,
    event_type: &str,
    run_id: &str,
    summary: &str,
) -> io::Result<String> {
    append_event_with_payload(workspace, event_type, run_id, summary, None)
}

pub fn append_event_with_payload(
    workspace: &Workspace,
    event_type: &str,
    run_id: &str,
    summary: &str,
    payload_ref: Option<&str>,
) -> io::Result<String> {
    let event_id = format!(
        "evt_{}_{}_{}",
        sanitize_id(run_id),
        sanitize_id(event_type),
        now_nanos()
    );
    let timestamp = format!("unix-ms-{}", now_millis());
    let previous = fs::read_to_string(&workspace.ledger_path)
        .ok()
        .and_then(|contents| {
            contents
                .lines()
                .rev()
                .find(|line| !line.trim().is_empty())
                .map(str::to_string)
        });
    let parent_event_id = previous
        .as_deref()
        .and_then(|line| json_string_field(line, "id"));
    let parent_event_hash = previous
        .as_deref()
        .and_then(|line| json_string_field(line, "event_hash"));
    let canonical = canonical_event_json(&EventHashInput {
        event_id: &event_id,
        timestamp: &timestamp,
        workspace_id: &workspace.id,
        run_id,
        event_type,
        summary,
        payload_ref,
        parent_event_id: parent_event_id.as_deref(),
        parent_event_hash: parent_event_hash.as_deref(),
    });
    let event_hash = format!("sha256:{}", sha256_hex(canonical.as_bytes()));
    let parent_fields = match (parent_event_id, parent_event_hash) {
        (Some(parent_id), Some(parent_hash)) => format!(
            ",\"parent_event_id\":\"{}\",\"parent_event_hash\":\"{}\"",
            escape_json(&parent_id),
            escape_json(&parent_hash)
        ),
        _ => String::new(),
    };
    let payload_field = payload_ref
        .map(|value| format!(",\"payload_ref\":\"{}\"", escape_json(value)))
        .unwrap_or_default();
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&workspace.ledger_path)?;
    writeln!(
        file,
        "{{\"id\":\"{}\",\"timestamp\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"{}\",\"event_type\":\"{}\",\"actor\":{{\"type\":\"system\",\"id\":\"local_supervisor\"}},\"summary\":\"{}\"{}{},\"event_hash\":\"{}\",\"sensitivity\":\"private\",\"taint\":{{\"sources\":[\"trusted_system\"],\"can_authorize_actions\":false}}}}",
        escape_json(&event_id),
        escape_json(&timestamp),
        escape_json(&workspace.id),
        escape_json(run_id),
        escape_json(event_type),
        escape_json(summary),
        payload_field,
        parent_fields,
        event_hash
    )?;
    Ok(event_id)
}

pub fn file_read_request(run_id: &str, path: impl AsRef<Path>) -> ToolRequest {
    ToolRequest {
        id: format!("toolreq_{}_read", run_id),
        run_id: run_id.to_string(),
        verb: "read".to_string(),
        path: path.as_ref().to_path_buf(),
        explicit_user_intent: true,
    }
}

pub fn file_write_request(run_id: &str, path: impl AsRef<Path>) -> ToolRequest {
    ToolRequest {
        id: format!("toolreq_{}_write", run_id),
        run_id: run_id.to_string(),
        verb: "write".to_string(),
        path: path.as_ref().to_path_buf(),
        explicit_user_intent: true,
    }
}

pub fn evaluate_policy(
    workspace: &Workspace,
    request: &ToolRequest,
    consent: Option<&Consent>,
) -> PolicyDecision {
    let Some(resolved_path) = resolve_inside_workspace(workspace, &request.path) else {
        return deny(request, "Target is outside workspace boundary");
    };

    if !request.explicit_user_intent {
        return deny(request, "Request lacks explicit user intent");
    }

    match request.verb.as_str() {
        "read" => PolicyDecision {
            id: format!("policy_{}_allow_read", request.run_id),
            request_id: request.id.clone(),
            decision: Decision::Allow,
            risk_level: RiskLevel::L1,
            reason: "Explicit workspace-scoped read allowed".to_string(),
            lease: Some(ScopedLease {
                id: format!("lease_{}_read_{}", request.run_id, now_nanos()),
                run_id: request.run_id.clone(),
                expires_at_millis: now_millis() + 300_000,
                actions: vec!["read".to_string()],
                paths: vec![resolved_path],
                denied: vec!["read_home".to_string(), "read_secrets".to_string()],
            }),
        },
        "write" => {
            if consent.is_some_and(|value| value.request_id == request.id && value.approved) {
                PolicyDecision {
                    id: format!("policy_{}_allow_write", request.run_id),
                    request_id: request.id.clone(),
                    decision: Decision::Allow,
                    risk_level: RiskLevel::L3,
                    reason: "Explicit consent approved workspace-scoped write".to_string(),
                    lease: Some(ScopedLease {
                        id: format!("lease_{}_write_{}", request.run_id, now_nanos()),
                        run_id: request.run_id.clone(),
                        expires_at_millis: now_millis() + 300_000,
                        actions: vec!["write".to_string()],
                        paths: vec![resolved_path],
                        denied: vec![
                            "read_home".to_string(),
                            "read_secrets".to_string(),
                            "external_send".to_string(),
                        ],
                    }),
                }
            } else {
                PolicyDecision {
                    id: format!("policy_{}_ask_write", request.run_id),
                    request_id: request.id.clone(),
                    decision: Decision::Ask,
                    risk_level: RiskLevel::L3,
                    reason: "Workspace write requires explicit consent".to_string(),
                    lease: None,
                }
            }
        }
        _ => deny(request, "Unsupported operation"),
    }
}

pub fn read_with_lease(request: &ToolRequest, decision: &PolicyDecision) -> io::Result<String> {
    assert_lease(request, decision, "read")?;
    fs::read_to_string(&request.path)
}

pub fn write_with_lease(
    request: &ToolRequest,
    decision: &PolicyDecision,
    contents: &str,
) -> io::Result<()> {
    assert_lease(request, decision, "write")?;
    if let Some(parent) = request.path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&request.path, contents)
}

fn assert_lease(request: &ToolRequest, decision: &PolicyDecision, action: &str) -> io::Result<()> {
    if decision.decision != Decision::Allow {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!("policy did not allow request: {}", decision.reason),
        ));
    }
    let Some(lease) = &decision.lease else {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "missing scoped lease",
        ));
    };
    if !lease.actions.iter().any(|value| value == action) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "lease action mismatch",
        ));
    }
    if lease.expires_at_millis <= now_millis() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "lease expired",
        ));
    }
    let request_path = if request.path.exists() {
        request.path.canonicalize()?
    } else {
        let parent = request
            .path
            .parent()
            .ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "request path has no parent")
            })?
            .canonicalize()?;
        parent.join(request.path.file_name().ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidInput, "request path has no file name")
        })?)
    };
    if !lease.paths.iter().any(|value| value == &request_path) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "lease path mismatch",
        ));
    }
    Ok(())
}

fn resolve_inside_workspace(workspace: &Workspace, path: &Path) -> Option<PathBuf> {
    let root = workspace.root.canonicalize().ok()?;
    let path = if path.exists() {
        path.canonicalize().ok()?
    } else {
        let parent = path.parent()?.canonicalize().ok()?;
        parent.join(path.file_name()?)
    };
    if path.starts_with(&root) {
        Some(path)
    } else {
        None
    }
}

fn deny(request: &ToolRequest, reason: &str) -> PolicyDecision {
    PolicyDecision {
        id: format!("policy_{}_deny", request.run_id),
        request_id: request.id.clone(),
        decision: Decision::Deny,
        risk_level: RiskLevel::L5,
        reason: reason.to_string(),
        lease: None,
    }
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn now_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default()
}

fn escape_json(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn sanitize_id(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '_' || character == '-' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn canonical_event_json(input: &EventHashInput<'_>) -> String {
    let mut fields = vec![
        "\"actor\":{\"id\":\"local_supervisor\",\"type\":\"system\"}".to_string(),
        format!("\"event_type\":\"{}\"", escape_json(input.event_type)),
        format!("\"id\":\"{}\"", escape_json(input.event_id)),
    ];
    if let (Some(parent_id), Some(parent_hash)) = (input.parent_event_id, input.parent_event_hash) {
        fields.push(format!(
            "\"parent_event_hash\":\"{}\"",
            escape_json(parent_hash)
        ));
        fields.push(format!(
            "\"parent_event_id\":\"{}\"",
            escape_json(parent_id)
        ));
    }
    if let Some(payload_ref) = input.payload_ref {
        fields.push(format!("\"payload_ref\":\"{}\"", escape_json(payload_ref)));
    }
    fields.extend([
        format!("\"run_id\":\"{}\"", escape_json(input.run_id)),
        "\"sensitivity\":\"private\"".to_string(),
        format!("\"summary\":\"{}\"", escape_json(input.summary)),
        "\"taint\":{\"can_authorize_actions\":false,\"sources\":[\"trusted_system\"]}".to_string(),
        format!("\"timestamp\":\"{}\"", escape_json(input.timestamp)),
        format!("\"workspace_id\":\"{}\"", escape_json(input.workspace_id)),
    ]);
    format!("{{{}}}", fields.join(","))
}

fn json_string_field(line: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\"", key);
    let key_end = line.find(&needle)? + needle.len();
    let remainder = line[key_end..].trim_start();
    let remainder = remainder.strip_prefix(':')?.trim_start();
    let remainder = remainder.strip_prefix('"')?;
    let mut value = String::new();
    let mut escaped = false;
    for character in remainder.chars() {
        if escaped {
            match character {
                '"' => value.push('"'),
                '\\' => value.push('\\'),
                'n' => value.push('\n'),
                'r' => value.push('\r'),
                't' => value.push('\t'),
                other => value.push(other),
            }
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == '"' {
            return Some(value);
        } else {
            value.push(character);
        }
    }
    None
}

fn sha256_hex(input: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut data = input.to_vec();
    let bit_len = (data.len() as u64) * 8;
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_be_bytes());
    let mut h = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    for chunk in data.chunks_exact(64) {
        let mut w = [0u32; 64];
        for (index, word) in chunk.chunks_exact(4).enumerate() {
            w[index] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
        }
        for index in 16..64 {
            let s0 = w[index - 15].rotate_right(7)
                ^ w[index - 15].rotate_right(18)
                ^ (w[index - 15] >> 3);
            let s1 = w[index - 2].rotate_right(17)
                ^ w[index - 2].rotate_right(19)
                ^ (w[index - 2] >> 10);
            w[index] = w[index - 16]
                .wrapping_add(s0)
                .wrapping_add(w[index - 7])
                .wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for index in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[index])
                .wrapping_add(w[index]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        for (target, value) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *target = target.wrapping_add(value);
        }
    }
    h.iter().map(|value| format!("{value:08x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supervisor_poc_read_write_and_ledger() {
        let root = std::env::temp_dir().join(format!("aetherion-supervisor-{}", now_millis()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_test").unwrap();
        let registry_path = write_workspace_registry(&workspace).unwrap();
        let run_id = "run_rust_test";
        let read_path = root.join("README.md");
        let write_path = root.join("SUMMARY.md");
        fs::write(&read_path, "Aetherion Rust supervisor fixture\n").unwrap();

        append_event(
            &workspace,
            "run.started",
            run_id,
            "Rust supervisor POC started",
        )
        .unwrap();

        let read_request = file_read_request(run_id, &read_path);
        let read_decision = evaluate_policy(&workspace, &read_request, None);
        assert_eq!(read_decision.decision, Decision::Allow);
        let read_contents = read_with_lease(&read_request, &read_decision).unwrap();
        assert!(read_contents.contains("Rust supervisor fixture"));

        let write_request = file_write_request(run_id, &write_path);
        let write_pre_decision = evaluate_policy(&workspace, &write_request, None);
        assert_eq!(write_pre_decision.decision, Decision::Ask);
        assert!(write_with_lease(&write_request, &write_pre_decision, "nope").is_err());

        let consent = Consent {
            request_id: write_request.id.clone(),
            approved: true,
        };
        let write_decision = evaluate_policy(&workspace, &write_request, Some(&consent));
        let second_write_decision = evaluate_policy(&workspace, &write_request, Some(&consent));
        assert_eq!(write_decision.decision, Decision::Allow);
        assert_ne!(
            write_decision.lease.as_ref().unwrap().id,
            second_write_decision.lease.as_ref().unwrap().id
        );
        write_with_lease(
            &write_request,
            &write_decision,
            "Summary from Rust supervisor\n",
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(&write_path).unwrap(),
            "Summary from Rust supervisor\n"
        );

        append_event(
            &workspace,
            "run.completed",
            run_id,
            "Rust supervisor POC completed",
        )
        .unwrap();
        let ledger = fs::read_to_string(&workspace.ledger_path).unwrap();
        assert!(ledger.contains("run.started"));
        assert!(ledger.contains("run.completed"));
        assert!(ledger.contains("\"event_hash\":\"sha256:"));
        assert!(ledger.contains("\"parent_event_hash\":\"sha256:"));
        let registry = fs::read_to_string(registry_path).unwrap();
        assert!(registry.contains("\"authority\": \"rust-supervisor\""));
    }

    #[test]
    fn workspace_registry_init_is_idempotent_but_rejects_identity_changes() {
        let root = std::env::temp_dir().join(format!(
            "aetherion-supervisor-workspace-idempotent-{}",
            now_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_stable").unwrap();
        let first_path = write_workspace_registry(&workspace).unwrap();
        let first_contents = fs::read_to_string(&first_path).unwrap();

        let second_path = write_workspace_registry(&workspace).unwrap();
        assert_eq!(first_path, second_path);
        assert_eq!(fs::read_to_string(second_path).unwrap(), first_contents);

        let conflicting = init_workspace(&root, "ws_changed").unwrap();
        let error = write_workspace_registry(&conflicting).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::AlreadyExists);
        assert!(error.to_string().contains("identity mismatch"));
    }

    #[test]
    fn supervisor_rejects_wrong_path_and_expired_lease() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-negative-{}", now_millis()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_negative").unwrap();
        let run_id = "run_rust_negative";
        let path = root.join("README.md");
        let other = root.join("OTHER.md");
        fs::write(&path, "fixture").unwrap();
        fs::write(&other, "other").unwrap();

        let request = file_read_request(run_id, &path);
        let mut decision = evaluate_policy(&workspace, &request, None);
        let mut wrong_request = request.clone();
        wrong_request.path = other;
        assert!(read_with_lease(&wrong_request, &decision).is_err());

        decision.lease.as_mut().unwrap().expires_at_millis = 1;
        assert!(read_with_lease(&request, &decision).is_err());
    }

    #[test]
    fn sha256_matches_standard_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
