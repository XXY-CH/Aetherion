use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const EVENT_HASH_VERSION_V1: &str = "aetherion-event-v1";

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

#[derive(Clone, Debug, PartialEq)]
enum JsonValue {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

#[derive(Debug, Clone)]
pub struct ParsedJsonObject {
    fields: BTreeMap<String, JsonValue>,
}

impl ParsedJsonObject {
    pub fn optional_string(&self, key: &str) -> Result<Option<String>, String> {
        match self.fields.get(key) {
            None | Some(JsonValue::Null) => Ok(None),
            Some(JsonValue::String(value)) => Ok(Some(value.clone())),
            Some(_) => Err(format!("field {key} must be a string")),
        }
    }

    pub fn required_string(&self, key: &str) -> Result<String, String> {
        match self.optional_string(key)? {
            Some(value) if !value.is_empty() => Ok(value),
            _ => Err(format!("missing required string field {key}")),
        }
    }

    pub fn optional_bool(&self, key: &str) -> Result<Option<bool>, String> {
        match self.fields.get(key) {
            None | Some(JsonValue::Null) => Ok(None),
            Some(JsonValue::Bool(value)) => Ok(Some(*value)),
            Some(_) => Err(format!("field {key} must be a boolean")),
        }
    }
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
    recover_ledger_on_startup(&ledger_path)?;
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
            "{{\n  \"id\": \"{}\",\n  \"root\": \"{}\",\n  \"created_at\": \"{}\",\n  \"authority\": \"rust-supervisor\",\n  \"runtime_dir\": \"{}\",\n  \"ledger_path\": \"{}\"\n}}\n",
            escape_json(&workspace.id),
            escape_json(&workspace.root.display().to_string()),
            escape_json(&now_rfc3339_millis()),
            escape_json(&runtime_dir.display().to_string()),
            escape_json(&workspace.ledger_path.display().to_string())
        ),
    )?;
    Ok(registry_path)
}

fn recover_ledger_on_startup(ledger_path: &Path) -> io::Result<()> {
    let _lock = LedgerLock::acquire(ledger_path)?;
    remove_abandoned_ledger_temp_files(ledger_path)?;
    verify_ledger_hash_chain(ledger_path)
}

fn remove_abandoned_ledger_temp_files(ledger_path: &Path) -> io::Result<()> {
    let Some(parent) = ledger_path.parent() else {
        return Ok(());
    };
    let Some(file_name) = ledger_path.file_name().and_then(|value| value.to_str()) else {
        return Ok(());
    };
    let temp_prefix = format!("{file_name}.tmp.");
    for entry in fs::read_dir(parent)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&temp_prefix) {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn verify_ledger_hash_chain(ledger_path: &Path) -> io::Result<()> {
    let contents = fs::read_to_string(ledger_path)?;
    let mut previous_id: Option<String> = None;
    let mut previous_hash: Option<String> = None;
    for (index, line) in contents.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let line_number = index + 1;
        let parsed = parse_json(line).map_err(|reason| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                format!("invalid ledger JSON at line {line_number}: {reason}"),
            )
        })?;
        let object = json_object(&parsed, line_number)?;
        let event_id = required_object_string(object, "id", line_number)?;
        let parent_event_id = optional_object_string(object, "parent_event_id", line_number)?;
        let parent_event_hash = optional_object_string(object, "parent_event_hash", line_number)?;
        let event_hash = required_object_string(object, "event_hash", line_number)?;
        if parent_event_id != previous_id || parent_event_hash != previous_hash {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("ledger parent chain mismatch at line {line_number}"),
            ));
        }
        match optional_object_string(object, "hash_version", line_number)?.as_deref() {
            Some(EVENT_HASH_VERSION_V1) => {
                let expected_hash = event_hash_v1(&parsed, line_number)?;
                if event_hash != expected_hash {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("ledger event hash mismatch at line {line_number}"),
                    ));
                }
            }
            Some(version) => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("unsupported ledger hash version {version} at line {line_number}"),
                ));
            }
            None if is_supervisor_authored_event(object) => {
                let timestamp = required_object_string(object, "timestamp", line_number)?;
                let workspace_id = required_object_string(object, "workspace_id", line_number)?;
                let run_id = required_object_string(object, "run_id", line_number)?;
                let event_type = required_object_string(object, "event_type", line_number)?;
                let summary = required_object_string(object, "summary", line_number)?;
                let payload_ref = optional_object_string(object, "payload_ref", line_number)?;
                let expected_hash = format!(
                    "sha256:{}",
                    sha256_hex(
                        canonical_legacy_event_json(&EventHashInput {
                            event_id: &event_id,
                            timestamp: &timestamp,
                            workspace_id: &workspace_id,
                            run_id: &run_id,
                            event_type: &event_type,
                            summary: &summary,
                            payload_ref: payload_ref.as_deref(),
                            parent_event_id: parent_event_id.as_deref(),
                            parent_event_hash: parent_event_hash.as_deref(),
                        })
                        .as_bytes()
                    )
                );
                if event_hash != expected_hash {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!(
                            "ledger legacy supervisor event hash mismatch at line {line_number}"
                        ),
                    ));
                }
            }
            None => {}
        }
        previous_id = Some(event_id);
        previous_hash = Some(event_hash);
    }
    Ok(())
}

fn json_object(value: &JsonValue, line_number: usize) -> io::Result<&BTreeMap<String, JsonValue>> {
    match value {
        JsonValue::Object(object) => Ok(object),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("ledger line {line_number} must be a JSON object"),
        )),
    }
}

fn required_object_string(
    object: &BTreeMap<String, JsonValue>,
    key: &str,
    line_number: usize,
) -> io::Result<String> {
    optional_object_string(object, key, line_number)?.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("ledger line {line_number} missing string field {key}"),
        )
    })
}

fn optional_object_string(
    object: &BTreeMap<String, JsonValue>,
    key: &str,
    line_number: usize,
) -> io::Result<Option<String>> {
    match object.get(key) {
        None | Some(JsonValue::Null) => Ok(None),
        Some(JsonValue::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("ledger line {line_number} field {key} must be a string"),
        )),
    }
}

fn is_supervisor_authored_event(object: &BTreeMap<String, JsonValue>) -> bool {
    let Some(JsonValue::Object(actor)) = object.get("actor") else {
        return false;
    };
    matches!(
        (actor.get("type"), actor.get("id")),
        (
            Some(JsonValue::String(actor_type)),
            Some(JsonValue::String(actor_id))
        ) if actor_type == "system" && actor_id == "local_supervisor"
    )
}

fn event_hash_v1(value: &JsonValue, line_number: usize) -> io::Result<String> {
    let JsonValue::Object(object) = value else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("ledger line {line_number} must be a JSON object"),
        ));
    };
    let mut without_hash = object.clone();
    if without_hash.remove("event_hash").is_none() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("ledger line {line_number} missing string field event_hash"),
        ));
    }
    let canonical = canonical_json(&JsonValue::Object(without_hash));
    Ok(format!("sha256:{}", sha256_hex(canonical.as_bytes())))
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
    let _lock = LedgerLock::acquire(&workspace.ledger_path)?;
    let event_id = format!(
        "evt_{}_{}_{}",
        sanitize_id(run_id),
        sanitize_id(event_type),
        now_nanos()
    );
    let timestamp = now_rfc3339_millis();
    let ledger_before = fs::read_to_string(&workspace.ledger_path).unwrap_or_default();
    let previous = ledger_before
        .lines()
        .rev()
        .find(|line| !line.trim().is_empty())
        .map(str::to_string);
    let parent_event_id = previous
        .as_deref()
        .and_then(|line| json_string_field(line, "id"));
    let parent_event_hash = previous
        .as_deref()
        .and_then(|line| json_string_field(line, "event_hash"));
    let canonical = canonical_event_json_v1(&EventHashInput {
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
    let event_line = format!(
        "{{\"id\":\"{}\",\"timestamp\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"{}\",\"event_type\":\"{}\",\"actor\":{{\"type\":\"system\",\"id\":\"local_supervisor\"}},\"summary\":\"{}\",\"hash_version\":\"{}\"{}{},\"event_hash\":\"{}\",\"sensitivity\":\"private\",\"taint\":{{\"sources\":[\"trusted_system\"],\"can_authorize_actions\":false}}}}",
        escape_json(&event_id),
        escape_json(&timestamp),
        escape_json(&workspace.id),
        escape_json(run_id),
        escape_json(event_type),
        escape_json(summary),
        EVENT_HASH_VERSION_V1,
        payload_field,
        parent_fields,
        event_hash
    );
    atomic_rewrite_ledger(&workspace.ledger_path, &ledger_before, &event_line)?;
    Ok(event_id)
}

fn atomic_rewrite_ledger(
    ledger_path: &Path,
    current_contents: &str,
    event_line: &str,
) -> io::Result<()> {
    let temp_path =
        ledger_path.with_extension(format!("jsonl.tmp.{}.{}", std::process::id(), now_nanos()));
    let mut next_contents = String::with_capacity(current_contents.len() + event_line.len() + 2);
    next_contents.push_str(current_contents);
    if !next_contents.is_empty() && !next_contents.ends_with('\n') {
        next_contents.push('\n');
    }
    next_contents.push_str(event_line);
    next_contents.push('\n');

    {
        let mut temp = File::create(&temp_path)?;
        temp.write_all(next_contents.as_bytes())?;
        temp.sync_all()?;
    }
    fs::rename(&temp_path, ledger_path)?;
    sync_parent_dir(ledger_path)?;
    Ok(())
}

fn sync_parent_dir(path: &Path) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if let Ok(dir) = File::open(parent) {
            dir.sync_all()?;
        }
    }
    Ok(())
}

struct LedgerLock {
    path: PathBuf,
}

impl LedgerLock {
    fn acquire(ledger_path: &Path) -> io::Result<Self> {
        let lock_path = ledger_path.with_extension("jsonl.lock");
        let started = SystemTime::now();
        loop {
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&lock_path)
            {
                Ok(mut file) => {
                    writeln!(
                        file,
                        "pid={} acquired_at={}",
                        std::process::id(),
                        now_rfc3339_millis()
                    )?;
                    return Ok(Self { path: lock_path });
                }
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                    if lock_is_stale(&lock_path) {
                        let _ = fs::remove_file(&lock_path);
                        continue;
                    }
                    if started
                        .elapsed()
                        .unwrap_or_default()
                        .gt(&Duration::from_secs(5))
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::TimedOut,
                            format!("timed out waiting for ledger lock {}", lock_path.display()),
                        ));
                    }
                    thread::sleep(Duration::from_millis(5));
                }
                Err(error) => return Err(error),
            }
        }
    }
}

impl Drop for LedgerLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn lock_is_stale(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .and_then(|modified| modified.elapsed().map_err(io::Error::other))
        .is_ok_and(|age| age > Duration::from_secs(30))
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

fn now_rfc3339_millis() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    rfc3339_from_unix_millis(duration.as_secs() as i64, duration.subsec_millis())
}

fn rfc3339_from_unix_millis(seconds: i64, millis: u32) -> String {
    let days = seconds.div_euclid(86_400);
    let seconds_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i64, u32, u32) {
    let shifted = days_since_unix_epoch + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    (year, month as u32, day as u32)
}

fn escape_json(value: &str) -> String {
    escape_json_canonical(value)
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

fn canonical_event_json_v1(input: &EventHashInput<'_>) -> String {
    let mut fields = vec![
        "\"actor\":{\"id\":\"local_supervisor\",\"type\":\"system\"}".to_string(),
        format!("\"event_type\":\"{}\"", escape_json(input.event_type)),
        format!("\"hash_version\":\"{}\"", EVENT_HASH_VERSION_V1),
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

fn canonical_legacy_event_json(input: &EventHashInput<'_>) -> String {
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

pub fn parse_json_object(input: &str) -> Result<ParsedJsonObject, String> {
    match parse_json(input)? {
        JsonValue::Object(fields) => Ok(ParsedJsonObject { fields }),
        _ => Err("JSON value must be an object".to_string()),
    }
}

fn parse_json(input: &str) -> Result<JsonValue, String> {
    let mut parser = JsonParser {
        bytes: input.as_bytes(),
        position: 0,
    };
    let value = parser.parse_value()?;
    parser.skip_whitespace();
    if parser.position != parser.bytes.len() {
        return Err(format!(
            "unexpected trailing data at byte {}",
            parser.position
        ));
    }
    Ok(value)
}

struct JsonParser<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl JsonParser<'_> {
    fn parse_value(&mut self) -> Result<JsonValue, String> {
        self.skip_whitespace();
        match self.peek_byte() {
            Some(b'n') => {
                self.consume_literal(b"null")?;
                Ok(JsonValue::Null)
            }
            Some(b't') => {
                self.consume_literal(b"true")?;
                Ok(JsonValue::Bool(true))
            }
            Some(b'f') => {
                self.consume_literal(b"false")?;
                Ok(JsonValue::Bool(false))
            }
            Some(b'"') => self.parse_string().map(JsonValue::String),
            Some(b'[') => self.parse_array(),
            Some(b'{') => self.parse_object(),
            Some(b'-' | b'0'..=b'9') => self.parse_number().map(JsonValue::Number),
            Some(other) => Err(format!(
                "unexpected byte {} at byte {}",
                other, self.position
            )),
            None => Err("unexpected end of JSON".to_string()),
        }
    }

    fn parse_array(&mut self) -> Result<JsonValue, String> {
        self.expect_byte(b'[')?;
        self.skip_whitespace();
        let mut values = Vec::new();
        if self.consume_if(b']') {
            return Ok(JsonValue::Array(values));
        }
        loop {
            values.push(self.parse_value()?);
            self.skip_whitespace();
            if self.consume_if(b']') {
                return Ok(JsonValue::Array(values));
            }
            self.expect_byte(b',')?;
        }
    }

    fn parse_object(&mut self) -> Result<JsonValue, String> {
        self.expect_byte(b'{')?;
        self.skip_whitespace();
        let mut fields = BTreeMap::new();
        if self.consume_if(b'}') {
            return Ok(JsonValue::Object(fields));
        }
        loop {
            self.skip_whitespace();
            let key = self.parse_string()?;
            self.skip_whitespace();
            self.expect_byte(b':')?;
            let value = self.parse_value()?;
            if fields.insert(key.clone(), value).is_some() {
                return Err(format!("duplicate JSON object key {key}"));
            }
            self.skip_whitespace();
            if self.consume_if(b'}') {
                return Ok(JsonValue::Object(fields));
            }
            self.expect_byte(b',')?;
        }
    }

    fn parse_string(&mut self) -> Result<String, String> {
        self.expect_byte(b'"')?;
        let mut output = String::new();
        let mut segment_start = self.position;
        while let Some(byte) = self.peek_byte() {
            match byte {
                b'"' => {
                    output.push_str(self.utf8_segment(segment_start, self.position)?);
                    self.position += 1;
                    return Ok(output);
                }
                b'\\' => {
                    output.push_str(self.utf8_segment(segment_start, self.position)?);
                    self.position += 1;
                    let escape = self
                        .next_byte()
                        .ok_or_else(|| "unterminated JSON escape".to_string())?;
                    match escape {
                        b'"' => output.push('"'),
                        b'\\' => output.push('\\'),
                        b'/' => output.push('/'),
                        b'b' => output.push('\u{0008}'),
                        b'f' => output.push('\u{000c}'),
                        b'n' => output.push('\n'),
                        b'r' => output.push('\r'),
                        b't' => output.push('\t'),
                        b'u' => output.push(self.parse_unicode_escape()?),
                        other => {
                            return Err(format!(
                                "invalid JSON escape {} at byte {}",
                                other,
                                self.position.saturating_sub(1)
                            ));
                        }
                    }
                    segment_start = self.position;
                }
                0x00..=0x1f => {
                    return Err(format!(
                        "unescaped control character at byte {}",
                        self.position
                    ));
                }
                _ => self.position += 1,
            }
        }
        Err("unterminated JSON string".to_string())
    }

    fn parse_unicode_escape(&mut self) -> Result<char, String> {
        let first = self.parse_hex_quad()?;
        if (0xd800..=0xdbff).contains(&first) {
            self.expect_byte(b'\\')?;
            self.expect_byte(b'u')?;
            let second = self.parse_hex_quad()?;
            if !(0xdc00..=0xdfff).contains(&second) {
                return Err("invalid JSON low surrogate".to_string());
            }
            let codepoint = 0x10000 + (((first - 0xd800) as u32) << 10) + (second - 0xdc00) as u32;
            char::from_u32(codepoint).ok_or_else(|| "invalid JSON codepoint".to_string())
        } else if (0xdc00..=0xdfff).contains(&first) {
            Err("unexpected JSON low surrogate".to_string())
        } else {
            char::from_u32(first as u32).ok_or_else(|| "invalid JSON codepoint".to_string())
        }
    }

    fn parse_hex_quad(&mut self) -> Result<u16, String> {
        let mut value = 0u16;
        for _ in 0..4 {
            let byte = self
                .next_byte()
                .ok_or_else(|| "incomplete JSON unicode escape".to_string())?;
            let digit = match byte {
                b'0'..=b'9' => (byte - b'0') as u16,
                b'a'..=b'f' => (byte - b'a' + 10) as u16,
                b'A'..=b'F' => (byte - b'A' + 10) as u16,
                _ => return Err("invalid JSON unicode escape".to_string()),
            };
            value = (value << 4) | digit;
        }
        Ok(value)
    }

    fn parse_number(&mut self) -> Result<String, String> {
        let start = self.position;
        self.consume_if(b'-');
        match self.peek_byte() {
            Some(b'0') => self.position += 1,
            Some(b'1'..=b'9') => {
                self.position += 1;
                while matches!(self.peek_byte(), Some(b'0'..=b'9')) {
                    self.position += 1;
                }
            }
            _ => return Err(format!("invalid JSON number at byte {start}")),
        }
        if self.consume_if(b'.') {
            let fraction_start = self.position;
            while matches!(self.peek_byte(), Some(b'0'..=b'9')) {
                self.position += 1;
            }
            if self.position == fraction_start {
                return Err(format!("invalid JSON fraction at byte {start}"));
            }
        }
        if matches!(self.peek_byte(), Some(b'e' | b'E')) {
            self.position += 1;
            if matches!(self.peek_byte(), Some(b'+' | b'-')) {
                self.position += 1;
            }
            let exponent_start = self.position;
            while matches!(self.peek_byte(), Some(b'0'..=b'9')) {
                self.position += 1;
            }
            if self.position == exponent_start {
                return Err(format!("invalid JSON exponent at byte {start}"));
            }
        }
        self.utf8_segment(start, self.position).map(str::to_string)
    }

    fn consume_literal(&mut self, literal: &[u8]) -> Result<(), String> {
        if self.bytes.get(self.position..self.position + literal.len()) == Some(literal) {
            self.position += literal.len();
            Ok(())
        } else {
            Err(format!("invalid JSON literal at byte {}", self.position))
        }
    }

    fn expect_byte(&mut self, expected: u8) -> Result<(), String> {
        self.skip_whitespace();
        match self.next_byte() {
            Some(actual) if actual == expected => Ok(()),
            Some(actual) => Err(format!(
                "expected byte {expected}, found {actual} at byte {}",
                self.position.saturating_sub(1)
            )),
            None => Err(format!("expected byte {expected}, found end of JSON")),
        }
    }

    fn consume_if(&mut self, expected: u8) -> bool {
        self.skip_whitespace();
        if self.peek_byte() == Some(expected) {
            self.position += 1;
            true
        } else {
            false
        }
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek_byte(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.position += 1;
        }
    }

    fn peek_byte(&self) -> Option<u8> {
        self.bytes.get(self.position).copied()
    }

    fn next_byte(&mut self) -> Option<u8> {
        let byte = self.peek_byte()?;
        self.position += 1;
        Some(byte)
    }

    fn utf8_segment(&self, start: usize, end: usize) -> Result<&str, String> {
        std::str::from_utf8(&self.bytes[start..end])
            .map_err(|_| format!("invalid UTF-8 in JSON string at byte {start}"))
    }
}

fn canonical_json(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => "null".to_string(),
        JsonValue::Bool(value) => value.to_string(),
        JsonValue::Number(value) => value.clone(),
        JsonValue::String(value) => format!("\"{}\"", escape_json_canonical(value)),
        JsonValue::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        JsonValue::Object(fields) => format!(
            "{{{}}}",
            fields
                .iter()
                .map(|(key, value)| format!(
                    "\"{}\":{}",
                    escape_json_canonical(key),
                    canonical_json(value)
                ))
                .collect::<Vec<_>>()
                .join(",")
        ),
    }
}

fn escape_json_canonical(value: &str) -> String {
    let mut escaped = String::new();
    for character in value.chars() {
        match character {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\u{0008}' => escaped.push_str("\\b"),
            '\u{000c}' => escaped.push_str("\\f"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            '\u{0000}'..='\u{001f}' => {
                escaped.push_str(&format!("\\u{:04x}", character as u32));
            }
            _ => escaped.push(character),
        }
    }
    escaped
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
        assert!(!registry.contains("unix-ms-"));
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
    fn concurrent_appends_are_serialized_by_a_ledger_lock() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-concurrent-{}", now_nanos()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_concurrent").unwrap();
        let worker_count = 24;
        let mut handles = Vec::new();

        for index in 0..worker_count {
            let workspace = workspace.clone();
            handles.push(thread::spawn(move || {
                append_event(
                    &workspace,
                    "observation.recorded",
                    &format!("run_concurrent_{index}"),
                    &format!("Concurrent event {index}"),
                )
                .unwrap()
            }));
        }

        let mut event_ids = Vec::new();
        for handle in handles {
            event_ids.push(handle.join().unwrap());
        }
        event_ids.sort();
        event_ids.dedup();
        assert_eq!(event_ids.len(), worker_count);

        let ledger = fs::read_to_string(&workspace.ledger_path).unwrap();
        let lines = ledger.lines().collect::<Vec<_>>();
        assert_eq!(lines.len(), worker_count);
        assert!(!workspace.ledger_path.with_extension("jsonl.lock").exists());
        assert_no_ledger_temp_files(&workspace);

        for (index, line) in lines.iter().enumerate() {
            assert!(json_string_field(line, "event_hash")
                .unwrap()
                .starts_with("sha256:"));
            if index == 0 {
                assert!(json_string_field(line, "parent_event_id").is_none());
                assert!(json_string_field(line, "parent_event_hash").is_none());
            } else {
                let previous = lines[index - 1];
                assert_eq!(
                    json_string_field(line, "parent_event_id").as_deref(),
                    json_string_field(previous, "id").as_deref()
                );
                assert_eq!(
                    json_string_field(line, "parent_event_hash").as_deref(),
                    json_string_field(previous, "event_hash").as_deref()
                );
            }
        }
    }

    #[test]
    fn atomic_rewrite_preserves_existing_ledger_without_trailing_newline() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-atomic-{}", now_nanos()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_atomic").unwrap();
        fs::write(
            &workspace.ledger_path,
            "{\"id\":\"evt_manual\",\"timestamp\":\"2026-06-07T00:00:00.000Z\",\"workspace_id\":\"ws_rust_atomic\",\"run_id\":\"run_manual\",\"event_type\":\"run.started\",\"actor\":{\"type\":\"system\",\"id\":\"local_supervisor\"},\"summary\":\"Manual prior event\",\"event_hash\":\"sha256:manual\",\"sensitivity\":\"private\",\"taint\":{\"sources\":[\"trusted_system\"],\"can_authorize_actions\":false}}"
        ).unwrap();

        append_event(
            &workspace,
            "run.completed",
            "run_manual",
            "Atomic append should create a complete second line",
        )
        .unwrap();

        let ledger = fs::read_to_string(&workspace.ledger_path).unwrap();
        let lines = ledger.lines().collect::<Vec<_>>();
        assert_eq!(lines.len(), 2);
        assert_eq!(
            json_string_field(lines[1], "parent_event_id").as_deref(),
            Some("evt_manual")
        );
        assert_eq!(
            json_string_field(lines[1], "parent_event_hash").as_deref(),
            Some("sha256:manual")
        );
        assert!(ledger.ends_with('\n'));
        assert_no_ledger_temp_files(&workspace);
    }

    #[test]
    fn startup_recovery_removes_abandoned_temp_files() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-recover-{}", now_nanos()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_recover").unwrap();
        append_event(
            &workspace,
            "run.started",
            "run_recover",
            "Recoverable ledger event",
        )
        .unwrap();
        let abandoned_temp = workspace
            .ledger_path
            .with_extension(format!("jsonl.tmp.{}.abandoned", std::process::id()));
        fs::write(&abandoned_temp, "uncommitted next ledger\n").unwrap();
        assert!(abandoned_temp.exists());

        let recovered = init_workspace(&root, "ws_rust_recover").unwrap();
        assert_eq!(recovered.ledger_path, workspace.ledger_path);
        assert!(!abandoned_temp.exists());
        assert_no_ledger_temp_files(&workspace);
        let ledger = fs::read_to_string(&workspace.ledger_path).unwrap();
        assert_eq!(ledger.lines().count(), 1);
    }

    #[test]
    fn startup_recovery_rejects_corrupt_hash_chain() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-corrupt-{}", now_nanos()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_corrupt").unwrap();
        append_event(
            &workspace,
            "run.started",
            "run_corrupt",
            "Valid event before corruption",
        )
        .unwrap();
        let ledger = fs::read_to_string(&workspace.ledger_path)
            .unwrap()
            .replace("\"event_hash\":\"sha256:", "\"event_hash\":\"sha256:0000");
        fs::write(&workspace.ledger_path, ledger).unwrap();

        let error = init_workspace(&root, "ws_rust_corrupt").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("ledger event hash mismatch"));
    }

    #[test]
    fn startup_recovery_verifies_typescript_authored_v1_events() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-cross-lang-{}", now_nanos()));
        let event_dir = root.join(".aetherion").join("events");
        fs::create_dir_all(&event_dir).unwrap();
        let ledger_path = event_dir.join("events.jsonl");
        let typescript_event = r#"{"id":"evt_cross_language_001","timestamp":"2026-06-07T10:00:00.000Z","workspace_id":"ws_cross_language","run_id":"run_cross_language","event_type":"user.message","actor":{"type":"user","id":"user_local"},"summary":"Cross-language hash\nverified","hash_version":"aetherion-event-v1","payload_ref":"artifact://cross/demo","sensitivity":"private","taint":{"sources":["user","public_web"],"can_authorize_actions":true},"retention":{"ttl":"30d","user_deletable":true},"links":["evt_source"],"event_hash":"sha256:d655e8b6de65915bce7c0cccb2eb03aa613fc7a864fcbfab08331499169e1afa"}"#;
        fs::write(&ledger_path, format!("{typescript_event}\n")).unwrap();

        let workspace = init_workspace(&root, "ws_cross_language").unwrap();
        assert_eq!(workspace.ledger_path, ledger_path);

        let tampered = typescript_event.replace("hash\\nverified", "hash\\ntampered");
        fs::write(&workspace.ledger_path, format!("{tampered}\n")).unwrap();
        let error = init_workspace(&root, "ws_cross_language").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("ledger event hash mismatch"));
    }

    #[test]
    fn startup_recovery_accepts_legacy_supervisor_hashes_but_rejects_unknown_versions() {
        let root =
            std::env::temp_dir().join(format!("aetherion-supervisor-legacy-{}", now_nanos()));
        let event_dir = root.join(".aetherion").join("events");
        fs::create_dir_all(&event_dir).unwrap();
        let ledger_path = event_dir.join("events.jsonl");
        let legacy_event = r#"{"id":"evt_legacy_supervisor_001","timestamp":"2026-06-07T09:00:00.000Z","workspace_id":"ws_legacy","run_id":"run_legacy","event_type":"run.started","actor":{"type":"system","id":"local_supervisor"},"summary":"Legacy supervisor event","event_hash":"sha256:9c48664046cc527cb361ae577bfff89107fa57110bde06845cdf0b532ebbe7df","sensitivity":"private","taint":{"sources":["trusted_system"],"can_authorize_actions":false}}"#;
        fs::write(&ledger_path, format!("{legacy_event}\n")).unwrap();

        let workspace = init_workspace(&root, "ws_legacy").unwrap();
        assert_eq!(workspace.ledger_path, ledger_path);

        let unknown_version = legacy_event.replace(
            "\"event_hash\":",
            "\"hash_version\":\"aetherion-event-v999\",\"event_hash\":",
        );
        fs::write(&workspace.ledger_path, format!("{unknown_version}\n")).unwrap();
        let error = init_workspace(&root, "ws_legacy").unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
        assert!(error
            .to_string()
            .contains("unsupported ledger hash version"));
    }

    #[test]
    fn sha256_matches_standard_vector() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn rust_events_use_schema_compatible_utc_timestamps() {
        assert_eq!(rfc3339_from_unix_millis(0, 0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            rfc3339_from_unix_millis(1_704_067_200, 123),
            "2024-01-01T00:00:00.123Z"
        );
    }

    #[test]
    fn supervisor_events_escape_control_characters_and_recover_unicode() {
        let root = std::env::temp_dir().join(format!("aetherion-supervisor-json-{}", now_nanos()));
        fs::create_dir_all(&root).unwrap();
        let workspace = init_workspace(&root, "ws_rust_json").unwrap();
        append_event(
            &workspace,
            "observation.recorded",
            "run_rust_json",
            "Unicode 灵魂\tverified\nnext line",
        )
        .unwrap();

        let ledger = fs::read_to_string(&workspace.ledger_path).unwrap();
        assert!(ledger.contains("Unicode 灵魂\\tverified\\nnext line"));
        init_workspace(&root, "ws_rust_json").unwrap();
    }

    fn assert_no_ledger_temp_files(workspace: &Workspace) {
        let event_dir = workspace.ledger_path.parent().unwrap();
        let leftovers = fs::read_dir(event_dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .filter(|name| name.contains(".tmp.") || name.ends_with(".lock"))
            .collect::<Vec<_>>();
        assert!(
            leftovers.is_empty(),
            "leftover ledger temp files: {leftovers:?}"
        );
    }
}
