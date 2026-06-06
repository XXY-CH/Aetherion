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

pub fn append_event(
    workspace: &Workspace,
    event_type: &str,
    run_id: &str,
    summary: &str,
) -> io::Result<String> {
    let event_id = format!(
        "evt_{}_{}_{}",
        sanitize_id(run_id),
        sanitize_id(event_type),
        now_nanos()
    );
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&workspace.ledger_path)?;
    writeln!(
        file,
        "{{\"id\":\"{}\",\"timestamp\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"{}\",\"event_type\":\"{}\",\"actor\":{{\"type\":\"system\",\"id\":\"local_supervisor\"}},\"summary\":\"{}\",\"sensitivity\":\"private\",\"taint\":{{\"sources\":[\"trusted_system\"],\"can_authorize_actions\":false}}}}",
        escape_json(&event_id),
        escape_json(&format!("unix-ms-{}", now_millis())),
        escape_json(&workspace.id),
        escape_json(run_id),
        escape_json(event_type),
        escape_json(summary)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supervisor_poc_read_write_and_ledger() {
        let root = std::env::temp_dir().join(format!("aetherion-supervisor-{}", now_millis()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_test").unwrap();
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
    }

    #[test]
    fn supervisor_rejects_wrong_path_and_expired_lease() {
        let root = std::env::temp_dir().join(format!("aetherion-supervisor-negative-{}", now_millis()));
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
}
