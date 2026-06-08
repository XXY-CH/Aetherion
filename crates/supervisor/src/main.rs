use aetherion_supervisor::{
    append_event, append_event_with_payload, assert_workspace_id_for_root, evaluate_policy,
    file_read_request, file_write_request, init_workspace, ledger_status, parse_json_object,
    read_with_lease, write_with_lease, write_workspace_registry, Consent, Decision,
    ParsedJsonObject,
};
use std::env;
use std::fs;
use std::io::{self, BufRead, BufReader, Write};
#[cfg(unix)]
use std::os::unix::fs::FileTypeExt;
#[cfg(unix)]
use std::os::unix::net::UnixListener;
use std::path::PathBuf;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "help".to_string());
    match command.as_str() {
        "read" => Err(
            "legacy direct read is disabled; use rpc file.read.traced for traced lifecycle evidence"
                .to_string(),
        ),
        "rpc" => run_rpc(),
        "socket" => {
            let socket_options = parse_socket_options(args.collect())?;
            run_socket(
                &socket_options.path,
                socket_options.auth_token.as_deref(),
                socket_options.workspace_root.as_deref(),
            )
        }
        _ => {
            println!("Usage: aetherion-supervisor rpc | socket --path <socket>");
            Ok(())
        }
    }
}

fn run_rpc() -> Result<(), String> {
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        println!("{}", handle_rpc_line(&line, "stdio"));
    }
    Ok(())
}

struct SocketOptions {
    path: String,
    auth_token: Option<String>,
    workspace_root: Option<String>,
}

fn parse_socket_options(args: Vec<String>) -> Result<SocketOptions, String> {
    let mut path: Option<String> = None;
    let mut auth_token: Option<String> = None;
    let mut workspace_root: Option<String> = None;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--path" => {
                index += 1;
                let value = args.get(index).cloned().unwrap_or_default();
                if value.is_empty() {
                    return Err(socket_usage().to_string());
                }
                path = Some(value);
            }
            "--auth-token" => {
                index += 1;
                let value = args.get(index).cloned().unwrap_or_default();
                if value.is_empty() {
                    return Err("--auth-token requires a non-empty token".to_string());
                }
                auth_token = Some(value);
            }
            "--workspace-root" => {
                index += 1;
                let value = args.get(index).cloned().unwrap_or_default();
                if value.is_empty() {
                    return Err("--workspace-root requires a non-empty path".to_string());
                }
                workspace_root = Some(value);
            }
            other => return Err(format!("unsupported socket option {other}")),
        }
        index += 1;
    }
    let Some(path) = path else {
        return Err(socket_usage().to_string());
    };
    Ok(SocketOptions {
        path,
        auth_token,
        workspace_root,
    })
}

fn socket_usage() -> &'static str {
    "Usage: aetherion-supervisor socket --path <socket> [--auth-token <token>] [--workspace-root <root>]"
}

#[cfg(unix)]
fn run_socket(
    path: &str,
    auth_token: Option<&str>,
    workspace_root: Option<&str>,
) -> Result<(), String> {
    remove_existing_socket(path)?;
    let bound_workspace = match workspace_root {
        Some(root) => Some(BoundWorkspace::create(root, path)?),
        None => None,
    };
    let listener = UnixListener::bind(path).map_err(|error| error.to_string())?;
    for stream in listener.incoming() {
        run_socket_stream(
            stream.map_err(|error| error.to_string())?,
            auth_token,
            bound_workspace.as_ref(),
        )?;
    }
    Ok(())
}

#[cfg(unix)]
fn remove_existing_socket(path: &str) -> Result<(), String> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.file_type().is_socket() => {
            fs::remove_file(path).map_err(|error| error.to_string())
        }
        Ok(_) => Err(format!("refusing to remove non-socket path {path}")),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(unix)]
fn run_socket_stream(
    mut stream: std::os::unix::net::UnixStream,
    auth_token: Option<&str>,
    bound_workspace: Option<&BoundWorkspace>,
) -> Result<(), String> {
    let mut line = String::new();
    {
        let mut reader = BufReader::new(&stream);
        reader
            .read_line(&mut line)
            .map_err(|error| error.to_string())?;
    }
    if line.trim().is_empty() {
        return Ok(());
    }
    stream
        .write_all(
            format!(
                "{}\n",
                handle_socket_rpc_line(&line, auth_token, bound_workspace)
            )
            .as_bytes(),
        )
        .map_err(|error| error.to_string())?;
    stream.flush().map_err(|error| error.to_string())
}

#[cfg(not(unix))]
fn run_socket(
    _path: &str,
    _auth_token: Option<&str>,
    _workspace_root: Option<&str>,
) -> Result<(), String> {
    Err("local socket RPC is only available on Unix platforms in this POC".to_string())
}

#[derive(Debug)]
struct BoundWorkspace {
    root: PathBuf,
    id: String,
    lock_path: PathBuf,
}

impl BoundWorkspace {
    fn create(root: &str, socket_path: &str) -> Result<Self, String> {
        let root = aetherion_supervisor::resolved_workspace_root(root)
            .map_err(|error| error.to_string())?;
        let id = aetherion_supervisor::workspace_id_for_root(&root)
            .map_err(|error| error.to_string())?;
        let runtime_dir = root.join(".aetherion");
        fs::create_dir_all(&runtime_dir).map_err(|error| error.to_string())?;
        let lock_path = runtime_dir.join("supervisor.lock");
        fs::write(
            &lock_path,
            format!(
                "pid={}\ntransport=unix-socket\nworkspace_id={}\nsocket_path={}\n",
                std::process::id(),
                id,
                socket_path
            ),
        )
        .map_err(|error| error.to_string())?;
        Ok(Self {
            root,
            id,
            lock_path,
        })
    }
}

impl Drop for BoundWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.lock_path);
    }
}

fn handle_socket_rpc_line(
    line: &str,
    auth_token: Option<&str>,
    bound_workspace: Option<&BoundWorkspace>,
) -> String {
    let request = match parse_json_object(line) {
        Ok(request) => request,
        Err(error) => return error_response("rpc", &format!("invalid JSON RPC request: {error}")),
    };
    let id = match optional_string_field(&request, "id") {
        Ok(Some(value)) if !value.is_empty() => value,
        Ok(_) => "rpc".to_string(),
        Err(error) => return error_response("rpc", &error),
    };
    if let Some(expected_token) = auth_token {
        let supplied_token = match optional_string_field(&request, "auth_token") {
            Ok(value) => value,
            Err(error) => return error_response(&id, &error),
        };
        if supplied_token.as_deref() != Some(expected_token) {
            return error_response(&id, "socket RPC auth failed");
        }
    }
    if let Some(bound) = bound_workspace {
        let workspace_root = match required_string_field(&request, "workspace_root") {
            Ok(value) => value,
            Err(error) => return error_response(&id, &error),
        };
        let workspace_id = match required_string_field(&request, "workspace_id") {
            Ok(value) => value,
            Err(error) => return error_response(&id, &error),
        };
        let resolved_root = match aetherion_supervisor::resolved_workspace_root(&workspace_root) {
            Ok(value) => value,
            Err(error) => return error_response(&id, &error.to_string()),
        };
        if resolved_root != bound.root || workspace_id != bound.id {
            return error_response(&id, "socket RPC workspace binding mismatch");
        }
    }
    handle_rpc_line(line, "unix-socket")
}

fn handle_rpc_line(line: &str, transport: &str) -> String {
    let request = match parse_json_object(line) {
        Ok(request) => request,
        Err(error) => return error_response("rpc", &format!("invalid JSON RPC request: {error}")),
    };
    let id = match optional_string_field(&request, "id") {
        Ok(Some(value)) if !value.is_empty() => value,
        Ok(_) => "rpc".to_string(),
        Err(error) => return error_response("rpc", &error),
    };
    let method = match optional_string_field(&request, "method") {
        Ok(Some(value)) => value,
        Ok(None) => String::new(),
        Err(error) => return error_response(&id, &error),
    };
    let workspace_root = match required_string_field(&request, "workspace_root") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };
    let workspace_id = match required_string_field(&request, "workspace_id") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };
    let run_id = match required_string_field(&request, "run_id") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };
    if let Err(error) = assert_workspace_id_for_root(&workspace_root, &workspace_id) {
        return error_response(&id, &error.to_string());
    }

    let response = match method.as_str() {
        "workspace.init" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => match write_workspace_registry(&workspace) {
                Ok(registry_path) => format!(
                    "{{\"workspace_id\":\"{}\",\"ledger_path\":\"{}\",\"registry_path\":\"{}\"}}",
                    escape(&workspace.id),
                    escape(&workspace.ledger_path.display().to_string()),
                    escape(&registry_path.display().to_string())
                ),
                Err(error) => return error_response(&id, &error.to_string()),
            },
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "supervisor.status" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => match write_workspace_registry(&workspace) {
                Ok(registry_path) => match ledger_status(&workspace.ledger_path, &workspace.id) {
                    Ok(status) => format!(
                        "{{\"workspace_id\":\"{}\",\"authority\":\"rust-supervisor\",\"transport\":\"{}\",\"daemon_running\":false,\"ledger_chain_valid\":{},\"ledger_events\":{},\"ledger_head_event_id\":\"{}\",\"ledger_head_event_hash\":\"{}\",\"runtime_dir\":\"{}\",\"ledger_path\":\"{}\",\"registry_path\":\"{}\"}}",
                        escape(&workspace.id),
                        escape(transport),
                        status.chain_valid,
                        status.event_count,
                        escape(status.head_event_id.as_deref().unwrap_or("")),
                        escape(status.head_event_hash.as_deref().unwrap_or("")),
                        escape(&workspace.root.join(".aetherion").display().to_string()),
                        escape(&workspace.ledger_path.display().to_string()),
                        escape(&registry_path.display().to_string())
                    ),
                    Err(error) => return error_response(&id, &error.to_string()),
                },
                Err(error) => return error_response(&id, &error.to_string()),
            },
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "event.append" => {
            let event_type = match required_string_field(&request, "event_type") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let summary = match required_string_field(&request, "summary") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let payload_ref = match optional_string_field(&request, "payload_ref") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            if let Err(error) = assert_managed_event_type(&event_type) {
                return error_response(&id, error);
            }
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    match append_event_with_payload(
                        &workspace,
                        &event_type,
                        &run_id,
                        &summary,
                        payload_ref.as_deref(),
                    ) {
                        Ok(event_id) => format!(
                            "{{\"appended\":true,\"event_id\":\"{}\"}}",
                            escape(&event_id)
                        ),
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "run.resume.evaluate" => {
            let source = match required_string_field(&request, "source") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let trigger_id = match required_string_field(&request, "trigger_id") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            if source != "manual" && source != "file" && source != "deadline" {
                return error_response(&id, "resume source must be manual, file, or deadline");
            }
            let policy_decision_id = format!("policy_{}_resume_queue", run_id);
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    let summary = format!(
                        "Fresh resume policy {} allowed queueing only for {}; no lease was issued.",
                        policy_decision_id, trigger_id
                    );
                    match append_event(&workspace, "policy.decided", &run_id, &summary) {
                        Ok(event_id) => format!(
                            "{{\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"decision\":\"queue\",\"risk_level\":\"L1\",\"lease_id\":\"\",\"auto_execute_allowed\":false}}",
                            escape(&policy_decision_id),
                            escape(&event_id)
                        ),
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "security.taint.evaluate" => {
            let source_kind = match required_string_field(&request, "source_kind") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            if !matches!(
                source_kind.as_str(),
                "public_web"
                    | "email"
                    | "pdf"
                    | "im"
                    | "github_issue"
                    | "mcp_description"
                    | "third_party_content"
            ) {
                return error_response(&id, "unsupported untrusted source kind");
            }
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    if let Err(error) = write_workspace_registry(&workspace) {
                        return error_response(&id, &error.to_string());
                    }
                    let policy_decision_id = format!("policy_{}_taint_deny", run_id);
                    let summary = format!(
                        "Denied authorization from tainted {} content; no lease was issued.",
                        source_kind
                    );
                    match append_event(&workspace, "policy.decided", &run_id, &summary) {
                        Ok(event_id) => format!(
                            "{{\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"decision\":\"deny\",\"risk_level\":\"L5\",\"lease_id\":\"\",\"can_authorize_actions\":false}}",
                            escape(&policy_decision_id),
                            escape(&event_id)
                        ),
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "surface.outbox.evaluate" => {
            let visibility = match required_string_field(&request, "visibility") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let adapter = match required_string_field(&request, "adapter") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            if !matches!(visibility.as_str(), "dm" | "group" | "public") {
                return error_response(&id, "outbox visibility must be dm, group, or public");
            }
            if !matches!(adapter.as_str(), "telegram" | "slack" | "local_fixture") {
                return error_response(
                    &id,
                    "outbox adapter must be telegram, slack, or local_fixture",
                );
            }
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    if let Err(error) = write_workspace_registry(&workspace) {
                        return error_response(&id, &error.to_string());
                    }
                    let denied = visibility == "public";
                    let decision = if denied { "deny" } else { "ask" };
                    let risk = if denied { "L5" } else { "L3" };
                    let policy_decision_id = format!("policy_{}_outbox_{}", run_id, decision);
                    let summary = if denied {
                        format!(
                            "Denied public {} outbox send; no delivery, lease, or reusable approval was issued.",
                            adapter
                        )
                    } else {
                        format!(
                            "Queued {} {} outbox send for one scoped approval; no delivery or lease was issued.",
                            visibility, adapter
                        )
                    };
                    match append_event(&workspace, "policy.decided", &run_id, &summary) {
                        Ok(event_id) => format!(
                            "{{\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{}\",\"lease_id\":\"\",\"delivery_allowed\":false,\"one_scoped_approval\":true}}",
                            escape(&policy_decision_id),
                            escape(&event_id),
                            decision,
                            risk
                        ),
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "tool.evaluate" | "lease.issue" => {
            return error_response(
                &id,
                "legacy policy-only RPC is disabled; use traced action RPCs so policy and lease evidence enters the Ledger",
            );
        }
        "file.read" => {
            return error_response(
                &id,
                "legacy file.read is disabled; use file.read.traced for traced lifecycle evidence",
            );
        }
        "file.read.traced" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                if let Err(error) = write_workspace_registry(&workspace) {
                    return error_response(&id, &error.to_string());
                }
                let path = match required_string_field(&request, "path") {
                    Ok(value) => PathBuf::from(value),
                    Err(error) => return error_response(&id, &error),
                };
                match traced_read(&workspace, &run_id, path) {
                    Ok(response) => response,
                    Err(error) => return error_response(&id, &error.to_string()),
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "child.file.read" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                if let Err(error) = write_workspace_registry(&workspace) {
                    return error_response(&id, &error.to_string());
                }
                let path = match required_string_field(&request, "path") {
                    Ok(value) => PathBuf::from(value),
                    Err(error) => return error_response(&id, &error),
                };
                let request = file_read_request(&run_id, path);
                let request_event_id = match append_event(
                    &workspace,
                    "tool.requested",
                    &run_id,
                    &format!("Child requested workspace read {}", request.path.display()),
                ) {
                    Ok(event_id) => event_id,
                    Err(error) => return error_response(&id, &error.to_string()),
                };
                let decision = evaluate_policy(&workspace, &request, None);
                let decision_label = decision_name(&decision.decision);
                let risk_event_id = match append_event(
                    &workspace,
                    "risk.composed",
                    &run_id,
                    &format!(
                        "Composed {:?} risk for child workspace file read.",
                        decision.risk_level
                    ),
                ) {
                    Ok(event_id) => event_id,
                    Err(error) => return error_response(&id, &error.to_string()),
                };
                let policy_event_id = match append_event(
                    &workspace,
                    "policy.decided",
                    &run_id,
                    &format!(
                        "Child read policy {} for {}: {}",
                        decision_label,
                        request.path.display(),
                        decision.reason
                    ),
                ) {
                    Ok(event_id) => event_id,
                    Err(error) => return error_response(&id, &error.to_string()),
                };
                let lease_event_id = if let Some(lease) = &decision.lease {
                    match append_event(
                        &workspace,
                        "lease.issued",
                        &run_id,
                        &format!("Issued scoped child read lease {}.", lease.id),
                    ) {
                        Ok(event_id) => event_id,
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                } else {
                    String::new()
                };
                match read_with_lease(&request, &decision) {
                    Ok(contents) => {
                        let result_event_id = match append_event(
                            &workspace,
                            "tool.result",
                            &run_id,
                            &format!(
                                "Child workspace read completed for {} with {} bytes",
                                request.path.display(),
                                contents.len()
                            ),
                        ) {
                            Ok(event_id) => event_id,
                            Err(error) => return error_response(&id, &error.to_string()),
                        };
                        format!(
                            "{{\"contents\":\"{}\",\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"risk_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"{}\"}}",
                            escape(&contents),
                            escape(&request.id),
                            escape(&request_event_id),
                            escape(&risk_event_id),
                            escape(&decision.id),
                            escape(&policy_event_id),
                            escape(&lease_event_id),
                            escape(&result_event_id),
                            decision_name(&decision.decision),
                            decision.risk_level,
                            escape(decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
                        )
                    }
                    Err(error) => {
                        let result_event_id = match append_event(
                            &workspace,
                            "tool.result",
                            &run_id,
                            &format!(
                                "Child workspace read denied for {}: {}",
                                request.path.display(),
                                error
                            ),
                        ) {
                            Ok(event_id) => event_id,
                            Err(append_error) => {
                                return error_response(&id, &append_error.to_string())
                            }
                        };
                        format!(
                            "{{\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"risk_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"\",\"reason\":\"{}\"}}",
                            escape(&request.id),
                            escape(&request_event_id),
                            escape(&risk_event_id),
                            escape(&decision.id),
                            escape(&policy_event_id),
                            escape(&lease_event_id),
                            escape(&result_event_id),
                            decision_name(&decision.decision),
                            decision.risk_level,
                            escape(&error.to_string())
                        )
                    }
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "file.write.prepare" => {
            let path = match required_string_field(&request, "path") {
                Ok(value) => PathBuf::from(value),
                Err(error) => return error_response(&id, &error),
            };
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    if let Err(error) = write_workspace_registry(&workspace) {
                        return error_response(&id, &error.to_string());
                    }
                    match traced_write_prepare(&workspace, &run_id, path) {
                        Ok(response) => response,
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "file.write.commit" => {
            let path = match required_string_field(&request, "path") {
                Ok(value) => PathBuf::from(value),
                Err(error) => return error_response(&id, &error),
            };
            let contents = match required_string_field(&request, "contents") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let approved = match bool_field(&request, "approved") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let consent_record_json = match optional_string_field(&request, "consent_record_json") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let consent_payload_ref = match optional_string_field(&request, "consent_payload_ref") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            match init_workspace(&workspace_root, &workspace_id) {
                Ok(workspace) => {
                    match traced_write_commit(
                        &workspace,
                        &run_id,
                        path,
                        &contents,
                        approved,
                        consent_record_json.as_deref(),
                        consent_payload_ref.as_deref(),
                    ) {
                        Ok(response) => response,
                        Err(error) => return error_response(&id, &error.to_string()),
                    }
                }
                Err(error) => return error_response(&id, &error.to_string()),
            }
        }
        "file.write" => {
            return error_response(
                &id,
                "legacy file.write is disabled; use file.write.prepare and file.write.commit for traced write lifecycle evidence",
            );
        }
        "trace.replay" => {
            return error_response(
                &id,
                "legacy trace.replay is disabled; use Ether replay so Ledger reconstruction, Replay Record artifact, and replay.recorded evidence are persisted",
            );
        }
        _ => return error_response(&id, "unsupported method"),
    };

    format!(
        "{{\"jsonrpc\":\"2.0\",\"id\":\"{}\",\"result\":{}}}",
        escape(&id),
        response
    )
}

fn required_string_field(request: &ParsedJsonObject, key: &str) -> Result<String, String> {
    request.required_string(key)
}

fn optional_string_field(request: &ParsedJsonObject, key: &str) -> Result<Option<String>, String> {
    request.optional_string(key)
}

fn traced_read(
    workspace: &aetherion_supervisor::Workspace,
    run_id: &str,
    path: PathBuf,
) -> std::io::Result<String> {
    let request = file_read_request(run_id, path);
    let request_event_id = append_event(
        workspace,
        "tool.requested",
        run_id,
        &format!(
            "Rust supervisor requested workspace read {}",
            request.path.display()
        ),
    )?;
    let decision = evaluate_policy(workspace, &request, None);
    let risk_event_id = append_event(
        workspace,
        "risk.composed",
        run_id,
        &format!(
            "Composed {:?} risk for supervisor workspace file read.",
            decision.risk_level
        ),
    )?;
    let policy_event_id = append_event(
        workspace,
        "policy.decided",
        run_id,
        &format!(
            "Read policy {} for {}: {}",
            decision_name(&decision.decision),
            request.path.display(),
            decision.reason
        ),
    )?;
    let lease_event_id = if let Some(lease) = &decision.lease {
        append_event(
            workspace,
            "lease.issued",
            run_id,
            &format!("Issued scoped read lease {}.", lease.id),
        )?
    } else {
        String::new()
    };
    match read_with_lease(&request, &decision) {
        Ok(contents) => {
            let result_event_id = append_event(
                workspace,
                "tool.result",
                run_id,
                &format!(
                    "Rust supervisor read {} bytes from workspace file {}.",
                    contents.len(),
                    request.path.display()
                ),
            )?;
            Ok(format!(
                "{{\"contents\":\"{}\",\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"risk_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"{}\"}}",
                escape(&contents),
                escape(&request.id),
                escape(&request_event_id),
                escape(&risk_event_id),
                escape(&decision.id),
                escape(&policy_event_id),
                escape(&lease_event_id),
                escape(&result_event_id),
                decision_name(&decision.decision),
                decision.risk_level,
                escape(decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
            ))
        }
        Err(error) => {
            let result_event_id = append_event(
                workspace,
                "tool.result",
                run_id,
                &format!(
                    "Rust supervisor read denied for {}: {}",
                    request.path.display(),
                    error
                ),
            )?;
            Ok(format!(
                "{{\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"risk_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"\",\"reason\":\"{}\"}}",
                escape(&request.id),
                escape(&request_event_id),
                escape(&risk_event_id),
                escape(&decision.id),
                escape(&policy_event_id),
                escape(&lease_event_id),
                escape(&result_event_id),
                decision_name(&decision.decision),
                decision.risk_level,
                escape(&error.to_string())
            ))
        }
    }
}

fn traced_write_prepare(
    workspace: &aetherion_supervisor::Workspace,
    run_id: &str,
    path: PathBuf,
) -> std::io::Result<String> {
    let request = file_write_request(run_id, path);
    let request_event_id = append_event(
        workspace,
        "tool.requested",
        run_id,
        &format!(
            "Rust supervisor requested workspace write {}",
            request.path.display()
        ),
    )?;
    let decision = evaluate_policy(workspace, &request, None);
    let risk_event_id = append_event(
        workspace,
        "risk.composed",
        run_id,
        &format!(
            "Composed {:?} risk for supervisor workspace file write.",
            decision.risk_level
        ),
    )?;
    let policy_event_id = append_event(
        workspace,
        "policy.decided",
        run_id,
        &format!(
            "Write prepare policy {} for {}: {}",
            decision_name(&decision.decision),
            request.path.display(),
            decision.reason
        ),
    )?;
    Ok(format!(
        "{{\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"risk_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"\"}}",
        escape(&request.id),
        escape(&request_event_id),
        escape(&risk_event_id),
        escape(&decision.id),
        escape(&policy_event_id),
        decision_name(&decision.decision),
        decision.risk_level
    ))
}

fn traced_write_commit(
    workspace: &aetherion_supervisor::Workspace,
    run_id: &str,
    path: PathBuf,
    contents: &str,
    approved: bool,
    consent_record_json: Option<&str>,
    consent_payload_ref: Option<&str>,
) -> std::io::Result<String> {
    let request = file_write_request(run_id, path);
    let consent = Consent {
        request_id: request.id.clone(),
        approved,
    };
    let decision = evaluate_policy(workspace, &request, Some(&consent));
    let consent_event_id = if approved && decision.decision == Decision::Allow {
        write_consent_artifact_for_commit(
            workspace,
            run_id,
            &request.id,
            consent_record_json,
            consent_payload_ref,
        )?;
        append_event_with_payload(
            workspace,
            "consent.recorded",
            run_id,
            &format!(
                "User consent approved supervisor workspace write {}.",
                request.path.display()
            ),
            consent_payload_ref,
        )?
    } else {
        String::new()
    };
    let policy_event_id = append_event(
        workspace,
        "policy.decided",
        run_id,
        &format!(
            "Write commit policy {} for {}: {}",
            decision_name(&decision.decision),
            request.path.display(),
            decision.reason
        ),
    )?;
    let lease_event_id = if let Some(lease) = &decision.lease {
        append_event(
            workspace,
            "lease.issued",
            run_id,
            &format!("Issued scoped write lease {}.", lease.id),
        )?
    } else {
        String::new()
    };
    match write_with_lease(&request, &decision, contents) {
        Ok(()) => {
            let action_event_id = append_event(
                workspace,
                "action.recorded",
                run_id,
                &format!(
                    "Rust supervisor wrote workspace file {} through scoped policy.",
                    request.path.display()
                ),
            )?;
            let observed_contents = fs::read_to_string(&request.path);
            let verification_passed = observed_contents
                .as_ref()
                .is_ok_and(|observed| observed == contents);
            let observed_bytes = observed_contents
                .as_ref()
                .map(|observed| observed.len())
                .unwrap_or(0);
            let observation_summary = if verification_passed {
                format!(
                    "Supervisor observed expected workspace file state for {} with {} bytes.",
                    request.path.display(),
                    observed_bytes
                )
            } else if let Err(error) = &observed_contents {
                format!(
                    "Supervisor could not observe workspace file {} after write: {}.",
                    request.path.display(),
                    error
                )
            } else {
                format!(
                    "Supervisor observed unexpected workspace file state for {}.",
                    request.path.display()
                )
            };
            let observation_event_id =
                append_event(workspace, "observation.recorded", run_id, &observation_summary)?;
            let verification_status = if verification_passed {
                "passed"
            } else {
                "failed"
            };
            let verification_summary = if verification_passed {
                "Supervisor verified exact workspace file contents after scoped write."
            } else {
                "Supervisor verification failed after scoped workspace file write."
            };
            let verification_event_id =
                append_event(workspace, "verification.recorded", run_id, verification_summary)?;
            Ok(format!(
                "{{\"written\":true,\"request_id\":\"{}\",\"consent_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"action_id\":\"{}\",\"action_event_id\":\"{}\",\"observation_id\":\"{}\",\"observation_event_id\":\"{}\",\"observation_summary\":\"{}\",\"verification_id\":\"{}\",\"verification_event_id\":\"{}\",\"verification_status\":\"{}\",\"verification_summary\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"{}\"}}",
                escape(&request.id),
                escape(&consent_event_id),
                escape(&decision.id),
                escape(&policy_event_id),
                escape(&lease_event_id),
                escape(&format!("action_{}_write", run_id)),
                escape(&action_event_id),
                escape(&format!("obs_{}_file", run_id)),
                escape(&observation_event_id),
                escape(&observation_summary),
                escape(&format!("verify_{}_file", run_id)),
                escape(&verification_event_id),
                verification_status,
                escape(verification_summary),
                decision_name(&decision.decision),
                decision.risk_level,
                escape(decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
            ))
        }
        Err(error) => Ok(format!(
            "{{\"written\":false,\"request_id\":\"{}\",\"consent_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"lease_event_id\":\"{}\",\"action_event_id\":\"\",\"observation_event_id\":\"\",\"verification_event_id\":\"\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"\",\"reason\":\"{}\"}}",
            escape(&request.id),
            escape(&consent_event_id),
            escape(&decision.id),
            escape(&policy_event_id),
            escape(&lease_event_id),
            decision_name(&decision.decision),
            decision.risk_level,
            escape(&error.to_string())
        )),
    }
}

fn write_consent_artifact_for_commit(
    workspace: &aetherion_supervisor::Workspace,
    run_id: &str,
    request_id: &str,
    consent_record_json: Option<&str>,
    consent_payload_ref: Option<&str>,
) -> std::io::Result<()> {
    let expected_ref = format!("artifact://consent/{run_id}/write");
    match consent_payload_ref {
        Some(value) if value == expected_ref => {}
        Some(value) => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("consent payload ref {value} does not match {expected_ref}"),
            ));
        }
        None => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "approved write commit requires consent_payload_ref",
            ));
        }
    }
    let consent_json = consent_record_json.ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "approved write commit requires consent_record_json",
        )
    })?;
    let consent = parse_json_object(consent_json).map_err(|error| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("invalid consent record JSON: {error}"),
        )
    })?;
    let expected_id = format!("consent_{run_id}_write");
    require_consent_field(&consent, "id", &expected_id)?;
    require_consent_field(&consent, "workspace_id", &workspace.id)?;
    require_consent_field(&consent, "tool_request_id", request_id)?;
    require_consent_field(&consent, "decision", "approved")?;
    require_consent_field(&consent, "risk_level", "L3")?;

    let dir = workspace
        .root
        .join(".aetherion")
        .join("artifacts")
        .join("consent")
        .join(run_id);
    fs::create_dir_all(&dir)?;
    fs::write(dir.join(format!("{expected_id}.json")), consent_json)
}

fn require_consent_field(
    consent: &ParsedJsonObject,
    key: &str,
    expected: &str,
) -> std::io::Result<()> {
    let actual = consent.required_string(key).map_err(|error| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("invalid consent record field {key}: {error}"),
        )
    })?;
    if actual == expected {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("consent record field {key} expected {expected}, got {actual}"),
        ))
    }
}

#[cfg(test)]
fn string_field(line: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":\"", key);
    let start = line.find(&needle)? + needle.len();
    let mut value = String::new();
    let mut escaped = false;
    let mut unicode_digits = String::new();
    let mut unicode_remaining = 0;

    for character in line[start..].chars() {
        if unicode_remaining > 0 {
            unicode_digits.push(character);
            unicode_remaining -= 1;
            if unicode_remaining == 0 {
                let codepoint = u32::from_str_radix(&unicode_digits, 16).ok()?;
                value.push(char::from_u32(codepoint)?);
                unicode_digits.clear();
            }
            continue;
        }
        if escaped {
            match character {
                '"' => value.push('"'),
                '\\' => value.push('\\'),
                '/' => value.push('/'),
                'b' => value.push('\u{0008}'),
                'f' => value.push('\u{000C}'),
                'n' => value.push('\n'),
                'r' => value.push('\r'),
                't' => value.push('\t'),
                'u' => unicode_remaining = 4,
                _ => return None,
            }
            escaped = false;
            continue;
        }
        match character {
            '\\' => escaped = true,
            '"' => return Some(value),
            _ => value.push(character),
        }
    }
    None
}

fn bool_field(request: &ParsedJsonObject, key: &str) -> Result<bool, String> {
    request
        .optional_bool(key)
        .map(|value| value.unwrap_or(false))
}

fn assert_managed_event_type(event_type: &str) -> Result<(), &'static str> {
    match event_type {
        "tool.requested"
        | "risk.composed"
        | "policy.decided"
        | "lease.issued"
        | "consent.recorded"
        | "tool.result"
        | "action.recorded"
        | "observation.recorded"
        | "verification.recorded" => Err(
            "event.append cannot write authority-bearing action lifecycle events; use the dedicated traced supervisor RPC",
        ),
        _ => Ok(()),
    }
}

fn decision_name(decision: &Decision) -> &'static str {
    match decision {
        Decision::Allow => "allow",
        Decision::Ask => "ask",
        Decision::Deny => "deny",
    }
}

fn error_response(id: &str, message: &str) -> String {
    format!(
        "{{\"jsonrpc\":\"2.0\",\"id\":\"{}\",\"error\":\"{}\"}}",
        escape(id),
        escape(message)
    )
}

fn escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};
    #[cfg(unix)]
    use std::{os::unix::net::UnixStream, thread};

    fn derived_workspace_id(root: &std::path::Path) -> String {
        aetherion_supervisor::workspace_id_for_root(root).unwrap()
    }

    fn consent_record_json(run_id: &str, workspace_id: &str) -> String {
        format!(
            "{{\"id\":\"consent_{run_id}_write\",\"user_id\":\"user_local\",\"workspace_id\":\"{workspace_id}\",\"tool_request_id\":\"toolreq_{run_id}_write\",\"decision\":\"approved\",\"risk_level\":\"L3\",\"approved_at\":\"2026-06-05T20:00:01.000Z\",\"expires_at\":null,\"scope\":{{\"actions\":[\"write\"],\"paths\":[\"SUMMARY.md\"]}}}}\n"
        )
    }

    #[test]
    fn socket_options_accept_workspace_root_binding() {
        let options = parse_socket_options(vec![
            "--path".to_string(),
            "/tmp/aetherion.sock".to_string(),
            "--auth-token".to_string(),
            "local-token".to_string(),
            "--workspace-root".to_string(),
            "/tmp/aetherion-workspace".to_string(),
        ])
        .unwrap();

        assert_eq!(options.path, "/tmp/aetherion.sock");
        assert_eq!(options.auth_token.as_deref(), Some("local-token"));
        assert_eq!(
            options.workspace_root.as_deref(),
            Some("/tmp/aetherion-workspace")
        );
    }

    #[test]
    fn rpc_legacy_file_write_is_rejected_without_side_effects() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-json-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("SUMMARY.md");
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_write\",\"method\":\"file.write\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_rpc_test\",\"path\":\"{}\",\"approved\":true,\"contents\":\"line one\\nline \\\"two\\\"\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&target.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("legacy file.write is disabled"));
        assert!(response.contains("file.write.prepare and file.write.commit"));
        assert!(!target.exists());
        assert!(!root.join(".aetherion").exists());
    }

    #[test]
    fn rpc_legacy_policy_and_read_methods_are_rejected_without_runtime_state() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-legacy-methods-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("README.md");
        fs::write(&target, "legacy read must not leak\n").unwrap();
        let workspace_id = derived_workspace_id(&root);

        for (rpc_id, method, extra, message) in [
            (
                "rpc_tool_eval",
                "tool.evaluate",
                format!(
                    "\"path\":\"{}\",\"verb\":\"read\"",
                    escape(&target.display().to_string())
                ),
                "legacy policy-only RPC is disabled",
            ),
            (
                "rpc_lease_issue",
                "lease.issue",
                format!(
                    "\"path\":\"{}\",\"verb\":\"write\",\"approved\":true",
                    escape(&target.display().to_string())
                ),
                "legacy policy-only RPC is disabled",
            ),
            (
                "rpc_file_read",
                "file.read",
                format!("\"path\":\"{}\"", escape(&target.display().to_string())),
                "legacy file.read is disabled",
            ),
        ] {
            let request = format!(
                "{{\"id\":\"{}\",\"method\":\"{}\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_legacy_methods\",{}}}",
                rpc_id,
                method,
                escape(&root.display().to_string()),
                workspace_id,
                extra
            );
            let response = handle_rpc_line(&request, "stdio");
            assert!(response.contains(&format!("\"id\":\"{rpc_id}\"")));
            assert!(response.contains(message));
            assert!(!response.contains("legacy read must not leak"));
            assert!(!response.contains("\"lease_id\":\"lease_"));
        }

        assert!(!root.join(".aetherion").exists());
    }

    #[test]
    fn rpc_legacy_trace_replay_is_rejected_without_runtime_state() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-legacy-replay-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_trace_replay\",\"method\":\"trace.replay\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_replay_legacy\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"id\":\"rpc_trace_replay\""));
        assert!(response.contains("legacy trace.replay is disabled"));
        assert!(response.contains("Replay Record artifact"));
        assert!(!response.contains("\"live_side_effects_replayed\":false"));
        assert!(!root.join(".aetherion").exists());
    }

    #[test]
    fn rpc_event_append_cannot_forge_authority_lifecycle_events() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-event-guard-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);

        for event_type in [
            "tool.requested",
            "risk.composed",
            "policy.decided",
            "lease.issued",
            "consent.recorded",
            "tool.result",
            "action.recorded",
            "observation.recorded",
            "verification.recorded",
        ] {
            let request = format!(
                "{{\"id\":\"rpc_append_{}\",\"method\":\"event.append\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_event_guard\",\"event_type\":\"{}\",\"summary\":\"forged authority event\"}}",
                event_type.replace('.', "_"),
                escape(&root.display().to_string()),
                workspace_id,
                event_type
            );
            let response = handle_rpc_line(&request, "stdio");
            assert!(response
                .contains("event.append cannot write authority-bearing action lifecycle events"));
        }

        assert!(!root.join(".aetherion").exists());

        let governance_request = format!(
            "{{\"id\":\"rpc_append_governance\",\"method\":\"event.append\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_event_guard\",\"event_type\":\"memory.accepted\",\"summary\":\"governance projection event\",\"payload_ref\":\"artifact://memory/accept/mem_guard\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let governance_response = handle_rpc_line(&governance_request, "stdio");
        assert!(governance_response.contains("\"appended\":true"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"memory.accepted\""));
        assert!(ledger.contains("\"payload_ref\":\"artifact://memory/accept/mem_guard\""));
        assert!(!ledger.contains("\"event_type\":\"action.recorded\""));
        assert!(!ledger.contains("\"event_type\":\"lease.issued\""));
    }

    #[test]
    fn rpc_json_input_fails_closed_for_duplicate_or_wrong_typed_fields() {
        let malformed = handle_rpc_line(
            "{\"id\":\"rpc_malformed\",\"method\":\"workspace.init\"",
            "stdio",
        );
        assert!(malformed.contains("\"id\":\"rpc\""));
        assert!(malformed.contains("invalid JSON RPC request"));

        let duplicate = handle_rpc_line(
            "{\"id\":\"rpc_duplicate\",\"id\":\"rpc_shadow\",\"method\":\"workspace.init\",\"workspace_root\":\"/tmp\",\"workspace_id\":\"ws_duplicate\",\"run_id\":\"run_duplicate\"}",
            "stdio",
        );
        assert!(duplicate.contains("\"id\":\"rpc\""));
        assert!(duplicate.contains("duplicate JSON object key id"));

        let wrong_workspace_root = handle_rpc_line(
            "{\"id\":\"rpc_wrong_root\",\"method\":\"workspace.init\",\"workspace_root\":42,\"workspace_id\":\"ws_wrong_root\",\"run_id\":\"run_wrong_root\"}",
            "stdio",
        );
        assert!(wrong_workspace_root.contains("\"id\":\"rpc_wrong_root\""));
        assert!(wrong_workspace_root.contains("field workspace_root must be a string"));

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-json-types-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("SUMMARY.md");
        let workspace_id = derived_workspace_id(&root);
        let wrong_approval = format!(
            "{{\"id\":\"rpc_wrong_approval\",\"method\":\"file.write.commit\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_wrong_approval\",\"path\":\"{}\",\"approved\":\"true\",\"contents\":\"must not write\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&target.display().to_string())
        );
        let approval_response = handle_rpc_line(&wrong_approval, "stdio");
        assert!(approval_response.contains("\"id\":\"rpc_wrong_approval\""));
        assert!(approval_response.contains("field approved must be a boolean"));
        assert!(!target.exists());
    }

    #[test]
    fn rpc_rejects_workspace_id_drift_before_runtime_initialization() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-workspace-id-drift-{nonce}"));
        let request = format!(
            "{{\"id\":\"rpc_bad_workspace\",\"method\":\"workspace.init\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_rpc_wrong\",\"run_id\":\"run_bad_workspace\"}}",
            escape(&root.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"id\":\"rpc_bad_workspace\""));
        assert!(response.contains("does not match resolved root identity"));
        assert!(!root.join(".aetherion").exists());
    }

    #[test]
    fn rpc_resume_policy_queues_without_lease_or_auto_execution() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-resume-policy-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_resume\",\"method\":\"run.resume.evaluate\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_resume_test\",\"source\":\"manual\",\"trigger_id\":\"wake_resume_test\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"decision\":\"queue\""));
        assert!(response.contains("\"lease_id\":\"\""));
        assert!(response.contains("\"auto_execute_allowed\":false"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"policy.decided\""));
        assert!(ledger.contains("wake_resume_test"));
    }

    #[test]
    fn rpc_taint_policy_denies_authorization_without_a_lease() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-taint-policy-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_taint\",\"method\":\"security.taint.evaluate\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_taint_test\",\"source_kind\":\"public_web\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"decision\":\"deny\""));
        assert!(response.contains("\"lease_id\":\"\""));
        assert!(response.contains("\"can_authorize_actions\":false"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("Denied authorization from tainted public_web content"));
    }

    #[test]
    fn rpc_surface_outbox_queues_dm_but_denies_public_delivery() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-outbox-policy-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let dm_request = format!(
            "{{\"id\":\"rpc_outbox_dm\",\"method\":\"surface.outbox.evaluate\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_outbox_test\",\"visibility\":\"dm\",\"adapter\":\"local_fixture\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let dm_response = handle_rpc_line(&dm_request, "stdio");
        assert!(dm_response.contains("\"decision\":\"ask\""));
        assert!(dm_response.contains("\"risk_level\":\"L3\""));
        assert!(dm_response.contains("\"delivery_allowed\":false"));
        assert!(dm_response.contains("\"lease_id\":\"\""));

        let public_request = format!(
            "{{\"id\":\"rpc_outbox_public\",\"method\":\"surface.outbox.evaluate\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_outbox_public\",\"visibility\":\"public\",\"adapter\":\"slack\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let public_response = handle_rpc_line(&public_request, "stdio");
        assert!(public_response.contains("\"decision\":\"deny\""));
        assert!(public_response.contains("\"risk_level\":\"L5\""));
        assert!(public_response.contains("\"delivery_allowed\":false"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("Queued dm local_fixture outbox send for one scoped approval"));
        assert!(ledger.contains("Denied public slack outbox send"));
    }

    #[test]
    fn rpc_child_read_returns_policy_lease_and_ledger_evidence() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-child-read-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("README.md");
        fs::write(&target, "child evidence\n").unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_child_read\",\"method\":\"child.file.read\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_child_test\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&target.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"decision\":\"allow\""));
        assert!(response.contains("\"policy_decision_id\":\"policy_"));
        assert!(response.contains("\"lease_id\":\"lease_"));
        assert!(response.contains("\"contents\":\"child evidence\\n\""));
        assert!(response.contains("\"request_event_id\":\"evt_"));
        assert!(response.contains("\"risk_event_id\":\"evt_"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        assert!(response.contains("\"lease_event_id\":\"evt_"));
        assert!(response.contains("\"result_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        let event_types = ledger
            .lines()
            .filter_map(|line| string_field(line, "event_type"))
            .collect::<Vec<_>>();
        assert_eq!(
            event_types,
            vec![
                "tool.requested",
                "risk.composed",
                "policy.decided",
                "lease.issued",
                "tool.result"
            ]
        );

        let conflicting_request = format!(
            "{{\"id\":\"rpc_child_read_conflict\",\"method\":\"child.file.read\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_child_conflict\",\"run_id\":\"run_child_conflict\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            escape(&target.display().to_string())
        );
        let conflict_response = handle_rpc_line(&conflicting_request, "stdio");
        assert!(conflict_response.contains("does not match resolved root identity"));
    }

    #[test]
    fn rpc_child_read_denial_records_risk_without_lease() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-child-deny-{nonce}"));
        let outside_root =
            std::env::temp_dir().join(format!("aetherion-rpc-child-deny-outside-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside_root).unwrap();
        let outside = outside_root.join("README.md");
        fs::write(&outside, "outside child evidence\n").unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_child_read_deny\",\"method\":\"child.file.read\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_child_deny\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&outside.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"decision\":\"deny\""));
        assert!(response.contains("\"risk_level\":\"L5\""));
        assert!(response.contains("\"risk_event_id\":\"evt_"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        assert!(response.contains("\"lease_event_id\":\"\""));
        assert!(response.contains("\"result_event_id\":\"evt_"));
        assert!(response.contains("\"lease_id\":\"\""));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        let event_types = ledger
            .lines()
            .filter_map(|line| string_field(line, "event_type"))
            .collect::<Vec<_>>();
        assert_eq!(
            event_types,
            vec![
                "tool.requested",
                "risk.composed",
                "policy.decided",
                "tool.result"
            ]
        );
        assert!(ledger.contains("Target is outside workspace boundary"));
        assert!(!ledger.contains("\"event_type\":\"lease.issued\""));
    }

    #[test]
    fn rpc_traced_file_actions_emit_supervisor_lifecycle_events() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-traced-actions-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let input = root.join("README.md");
        let output = root.join(".aetherion").join("SUMMARY.md");
        fs::write(&input, "traced evidence\n").unwrap();
        let workspace_id = derived_workspace_id(&root);

        let read_request = format!(
            "{{\"id\":\"rpc_read_traced\",\"method\":\"file.read.traced\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_traced_test\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&input.display().to_string())
        );
        let read_response = handle_rpc_line(&read_request, "stdio");
        assert!(read_response.contains("\"contents\":\"traced evidence\\n\""));
        assert!(read_response.contains("\"request_event_id\":\"evt_"));
        assert!(read_response.contains("\"risk_event_id\":\"evt_"));
        assert!(read_response.contains("\"policy_event_id\":\"evt_"));
        assert!(read_response.contains("\"lease_event_id\":\"evt_"));
        assert!(read_response.contains("\"result_event_id\":\"evt_"));

        let prepare_request = format!(
            "{{\"id\":\"rpc_write_prepare\",\"method\":\"file.write.prepare\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_traced_test\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&output.display().to_string())
        );
        let prepare_response = handle_rpc_line(&prepare_request, "stdio");
        assert!(prepare_response.contains("\"decision\":\"ask\""));
        assert!(prepare_response.contains("\"risk_event_id\":\"evt_"));
        assert!(prepare_response.contains("\"lease_id\":\"\""));

        let consent_json = consent_record_json("run_traced_test", &workspace_id);
        let commit_request = format!(
            "{{\"id\":\"rpc_write_commit\",\"method\":\"file.write.commit\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_traced_test\",\"path\":\"{}\",\"approved\":true,\"consent_record_json\":\"{}\",\"consent_payload_ref\":\"artifact://consent/run_traced_test/write\",\"contents\":\"line one\\nline \\\"two\\\"\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&output.display().to_string()),
            escape(&consent_json)
        );
        let commit_response = handle_rpc_line(&commit_request, "stdio");
        assert!(commit_response.contains("\"written\":true"));
        assert!(commit_response.contains("\"policy_event_id\":\"evt_"));
        assert!(commit_response.contains("\"lease_event_id\":\"evt_"));
        assert!(commit_response.contains("\"action_event_id\":\"evt_"));
        assert!(commit_response.contains("\"consent_event_id\":\"evt_"));
        assert!(commit_response.contains("\"observation_event_id\":\"evt_"));
        assert!(commit_response.contains("\"verification_event_id\":\"evt_"));
        assert!(commit_response.contains("\"verification_status\":\"passed\""));
        assert_eq!(
            fs::read_to_string(&output).unwrap(),
            "line one\nline \"two\"\n"
        );

        let consent_artifact = root
            .join(".aetherion")
            .join("artifacts")
            .join("consent")
            .join("run_traced_test")
            .join("consent_run_traced_test_write.json");
        assert_eq!(fs::read_to_string(consent_artifact).unwrap(), consent_json);
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"consent.recorded\""));
        assert!(ledger.contains("\"payload_ref\":\"artifact://consent/run_traced_test/write\""));
        let event_types = ledger
            .lines()
            .filter_map(|line| string_field(line, "event_type"))
            .collect::<Vec<_>>();
        assert_eq!(
            event_types,
            vec![
                "tool.requested",
                "risk.composed",
                "policy.decided",
                "lease.issued",
                "tool.result",
                "tool.requested",
                "risk.composed",
                "policy.decided",
                "consent.recorded",
                "policy.decided",
                "lease.issued",
                "action.recorded",
                "observation.recorded",
                "verification.recorded"
            ]
        );
    }

    #[test]
    fn rpc_supervisor_status_reports_runtime_without_appending_events() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-status-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let status_request = format!(
            "{{\"id\":\"rpc_status_empty\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_status\"}}",
            escape(&root.display().to_string()),
            workspace_id
        );
        let status_response = handle_rpc_line(&status_request, "stdio");
        assert!(status_response.contains("\"authority\":\"rust-supervisor\""));
        assert!(status_response.contains("\"transport\":\"stdio\""));
        assert!(status_response.contains("\"daemon_running\":false"));
        assert!(status_response.contains("\"ledger_chain_valid\":true"));
        assert!(status_response.contains("\"ledger_events\":0"));
        assert!(status_response.contains("\"ledger_head_event_id\":\"\""));
        assert!(status_response.contains("\"registry_path\":\""));
        let ledger_path = root.join(".aetherion/events/events.jsonl");
        assert_eq!(fs::read_to_string(&ledger_path).unwrap(), "");

        append_event(
            &init_workspace(&root, &workspace_id).unwrap(),
            "run.started",
            "run_status_existing",
            "Existing run event",
        )
        .unwrap();
        let ledger_before = fs::read_to_string(&ledger_path).unwrap();
        let status_response = handle_rpc_line(&status_request, "stdio");
        assert!(status_response.contains("\"ledger_events\":1"));
        assert!(status_response.contains("\"ledger_head_event_id\":\"evt_"));
        assert!(status_response.contains("\"ledger_head_event_hash\":\"sha256:"));
        assert_eq!(fs::read_to_string(&ledger_path).unwrap(), ledger_before);
    }

    #[cfg(unix)]
    #[test]
    fn rpc_supervisor_status_over_socket_uses_same_read_only_handler() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-status-socket-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let socket_path = std::env::temp_dir().join(format!("aeth-{nonce}.sock"));
        let _ = fs::remove_file(&socket_path);
        let workspace_id = derived_workspace_id(&root);
        let listener = UnixListener::bind(&socket_path).unwrap();
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            run_socket_stream(stream, None, None).unwrap();
        });
        let mut client = UnixStream::connect(&socket_path).unwrap();
        let status_request = format!(
            "{{\"id\":\"rpc_status_socket\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_status_socket\"}}\n",
            escape(&root.display().to_string()),
            workspace_id
        );
        client.write_all(status_request.as_bytes()).unwrap();
        client.shutdown(std::net::Shutdown::Write).unwrap();
        let mut response = String::new();
        BufReader::new(&client).read_line(&mut response).unwrap();
        server.join().unwrap();

        assert!(response.contains("\"id\":\"rpc_status_socket\""));
        assert!(response.contains("\"transport\":\"unix-socket\""));
        assert!(response.contains("\"daemon_running\":false"));
        assert!(response.contains("\"ledger_chain_valid\":true"));
        assert!(response.contains("\"ledger_events\":0"));
        assert_eq!(
            fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap(),
            ""
        );
        let _ = fs::remove_file(&socket_path);
    }

    #[cfg(unix)]
    #[test]
    fn rpc_socket_auth_gate_rejects_before_runtime_initialization() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-status-socket-auth-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request_without_token = format!(
            "{{\"id\":\"rpc_status_missing_auth\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_status_socket_auth\"}}\n",
            escape(&root.display().to_string()),
            workspace_id
        );
        let missing_auth =
            handle_socket_rpc_line(&request_without_token, Some("expected-token"), None);
        assert!(missing_auth.contains("\"id\":\"rpc_status_missing_auth\""));
        assert!(missing_auth.contains("socket RPC auth failed"));
        assert!(!root.join(".aetherion").exists());

        let wrong_token = format!(
            "{{\"id\":\"rpc_status_wrong_auth\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_status_socket_auth\",\"auth_token\":\"wrong-token\"}}\n",
            escape(&root.display().to_string()),
            workspace_id
        );
        let wrong_auth = handle_socket_rpc_line(&wrong_token, Some("expected-token"), None);
        assert!(wrong_auth.contains("\"id\":\"rpc_status_wrong_auth\""));
        assert!(wrong_auth.contains("socket RPC auth failed"));
        assert!(!root.join(".aetherion").exists());

        let correct_token = format!(
            "{{\"id\":\"rpc_status_correct_auth\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_status_socket_auth\",\"auth_token\":\"expected-token\"}}\n",
            escape(&root.display().to_string()),
            workspace_id
        );
        let allowed = handle_socket_rpc_line(&correct_token, Some("expected-token"), None);
        assert!(allowed.contains("\"id\":\"rpc_status_correct_auth\""));
        assert!(allowed.contains("\"transport\":\"unix-socket\""));
        assert!(allowed.contains("\"ledger_events\":0"));
        assert_eq!(
            fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap(),
            ""
        );
    }

    #[cfg(unix)]
    #[test]
    fn bound_workspace_lock_file_is_created_and_removed_on_drop() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-socket-bound-lock-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let socket_path = std::env::temp_dir().join(format!("aeth-bound-{nonce}.sock"));
        let workspace_id = derived_workspace_id(&root);
        let lock_path = root.join(".aetherion/supervisor.lock");

        {
            let bound =
                BoundWorkspace::create(root.to_str().unwrap(), socket_path.to_str().unwrap())
                    .unwrap();
            assert_eq!(bound.id, workspace_id);
            assert_eq!(bound.lock_path, lock_path);
            let lock = fs::read_to_string(&lock_path).unwrap();
            assert!(lock.contains("pid="));
            assert!(lock.contains("transport=unix-socket"));
            assert!(lock.contains(&format!("workspace_id={workspace_id}")));
            assert!(lock.contains(&format!("socket_path={}", socket_path.display())));
        }

        assert!(!lock_path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn bound_socket_status_accepts_matching_workspace_and_keeps_lock() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-bound-status-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let socket_path = std::env::temp_dir().join(format!("aeth-bound-status-{nonce}.sock"));
        let workspace_id = derived_workspace_id(&root);
        let bound =
            BoundWorkspace::create(root.to_str().unwrap(), socket_path.to_str().unwrap()).unwrap();
        let lock_path = root.join(".aetherion/supervisor.lock");
        let request = format!(
            "{{\"id\":\"rpc_bound_status\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_bound_status\"}}\n",
            escape(&root.display().to_string()),
            workspace_id
        );

        let response = handle_socket_rpc_line(&request, None, Some(&bound));

        assert!(response.contains("\"id\":\"rpc_bound_status\""));
        assert!(response.contains("\"transport\":\"unix-socket\""));
        assert!(response.contains("\"ledger_events\":0"));
        assert!(lock_path.exists());
        assert_eq!(
            fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap(),
            ""
        );
    }

    #[cfg(unix)]
    #[test]
    fn bound_socket_rejects_cross_workspace_before_runtime_initialization() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-bound-home-{nonce}"));
        let other_root = std::env::temp_dir().join(format!("aetherion-bound-other-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&other_root).unwrap();
        let socket_path = std::env::temp_dir().join(format!("aeth-bound-cross-{nonce}.sock"));
        let bound =
            BoundWorkspace::create(root.to_str().unwrap(), socket_path.to_str().unwrap()).unwrap();
        let other_workspace_id = derived_workspace_id(&other_root);
        let request = format!(
            "{{\"id\":\"rpc_bound_cross\",\"method\":\"supervisor.status\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_bound_cross\"}}\n",
            escape(&other_root.display().to_string()),
            other_workspace_id
        );

        let response = handle_socket_rpc_line(&request, None, Some(&bound));

        assert!(response.contains("\"id\":\"rpc_bound_cross\""));
        assert!(response.contains("socket RPC workspace binding mismatch"));
        assert!(!other_root.join(".aetherion").exists());
        assert!(root.join(".aetherion/supervisor.lock").exists());
    }

    #[cfg(unix)]
    #[test]
    fn socket_mode_refuses_to_replace_non_socket_files() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("aeth-not-socket-{nonce}"));
        fs::write(&path, "do not replace").unwrap();
        let error = remove_existing_socket(path.to_str().unwrap()).unwrap_err();
        assert!(error.contains("refusing to remove non-socket path"));
        assert_eq!(fs::read_to_string(&path).unwrap(), "do not replace");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rpc_write_commit_without_approval_records_policy_but_no_action() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-traced-deny-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let output = root.join("SUMMARY.md");
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_write_commit_deny\",\"method\":\"file.write.commit\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_traced_deny\",\"path\":\"{}\",\"consent_payload_ref\":\"artifact://consent/run_traced_deny/write\",\"contents\":\"no approval\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&output.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"written\":false"));
        assert!(response.contains("\"decision\":\"ask\""));
        assert!(response.contains("\"action_event_id\":\"\""));
        assert!(!output.exists());
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"policy.decided\""));
        assert!(!ledger.contains("\"event_type\":\"consent.recorded\""));
        assert!(!ledger.contains("artifact://consent/run_traced_deny/write"));
        assert!(!ledger.contains("\"event_type\":\"action.recorded\""));
    }

    #[test]
    fn rpc_write_commit_requires_matching_consent_artifact_evidence_before_ledger_ref() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-consent-required-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let output = root.join("SUMMARY.md");
        let workspace_id = derived_workspace_id(&root);
        let missing_consent_request = format!(
            "{{\"id\":\"rpc_missing_consent\",\"method\":\"file.write.commit\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_consent_required\",\"path\":\"{}\",\"approved\":true,\"consent_payload_ref\":\"artifact://consent/run_consent_required/write\",\"contents\":\"must not write\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&output.display().to_string())
        );
        let missing_response = handle_rpc_line(&missing_consent_request, "stdio");
        assert!(missing_response.contains("approved write commit requires consent_record_json"));
        assert!(!output.exists());
        let ledger_path = root.join(".aetherion/events/events.jsonl");
        let ledger = fs::read_to_string(&ledger_path).unwrap();
        assert!(!ledger.contains("\"event_type\":\"consent.recorded\""));
        assert!(!ledger.contains("artifact://consent/run_consent_required/write"));

        let mismatched_consent = consent_record_json("run_other", &workspace_id);
        let mismatch_request = format!(
            "{{\"id\":\"rpc_mismatched_consent\",\"method\":\"file.write.commit\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_consent_required\",\"path\":\"{}\",\"approved\":true,\"consent_record_json\":\"{}\",\"consent_payload_ref\":\"artifact://consent/run_consent_required/write\",\"contents\":\"must not write\\n\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&output.display().to_string()),
            escape(&mismatched_consent)
        );
        let mismatch_response = handle_rpc_line(&mismatch_request, "stdio");
        assert!(mismatch_response
            .contains("consent record field id expected consent_run_consent_required_write"));
        assert!(!output.exists());
        let ledger = fs::read_to_string(ledger_path).unwrap();
        assert!(!ledger.contains("\"event_type\":\"consent.recorded\""));
        assert!(!ledger.contains("artifact://consent/run_consent_required/write"));
        assert!(!root
            .join(".aetherion")
            .join("artifacts")
            .join("consent")
            .join("run_consent_required")
            .join("consent_run_consent_required_write.json")
            .exists());
    }

    #[test]
    fn rpc_traced_read_outside_workspace_records_l5_deny_without_lease() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-traced-outside-{nonce}"));
        let outside_root =
            std::env::temp_dir().join(format!("aetherion-rpc-traced-outside-file-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside_root).unwrap();
        let outside = outside_root.join("secret.txt");
        fs::write(&outside, "outside\n").unwrap();
        let workspace_id = derived_workspace_id(&root);
        let request = format!(
            "{{\"id\":\"rpc_read_outside\",\"method\":\"file.read.traced\",\"workspace_root\":\"{}\",\"workspace_id\":\"{}\",\"run_id\":\"run_traced_outside\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            workspace_id,
            escape(&outside.display().to_string())
        );
        let response = handle_rpc_line(&request, "stdio");
        assert!(response.contains("\"decision\":\"deny\""));
        assert!(response.contains("\"risk_level\":\"L5\""));
        assert!(response.contains("\"lease_id\":\"\""));
        assert!(response.contains("\"result_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("Composed L5 risk for supervisor workspace file read"));
        assert!(ledger.contains("Target is outside workspace boundary"));
        assert!(!ledger.contains("\"event_type\":\"lease.issued\""));
    }
}
