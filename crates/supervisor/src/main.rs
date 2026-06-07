use aetherion_supervisor::{
    append_event, append_event_with_payload, evaluate_policy, file_read_request,
    file_write_request, init_workspace, read_with_lease, write_with_lease,
    write_workspace_registry, Consent, Decision,
};
use std::env;
use std::io::{self, BufRead};
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
        "read" => {
            let workspace_root = PathBuf::from(args.next().ok_or("missing workspace root")?);
            let file_path = PathBuf::from(args.next().ok_or("missing file path")?);
            let workspace = init_workspace(&workspace_root, "ws_rust_cli")
                .map_err(|error| error.to_string())?;
            let run_id = "run_rust_cli";
            append_event(
                &workspace,
                "run.started",
                run_id,
                "Rust supervisor CLI read started",
            )
            .map_err(|error| error.to_string())?;
            let request = file_read_request(run_id, file_path);
            let decision = evaluate_policy(&workspace, &request, None);
            let contents =
                read_with_lease(&request, &decision).map_err(|error| error.to_string())?;
            append_event(
                &workspace,
                "run.completed",
                run_id,
                "Rust supervisor CLI read completed",
            )
            .map_err(|error| error.to_string())?;
            print!("{contents}");
            Ok(())
        }
        "rpc" => run_rpc(),
        _ => {
            println!("Usage: aetherion-supervisor read <workspace-root> <file-path>");
            println!("       aetherion-supervisor rpc");
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
        println!("{}", handle_rpc_line(&line));
    }
    Ok(())
}

fn handle_rpc_line(line: &str) -> String {
    let id = string_field(line, "id").unwrap_or_else(|| "rpc".to_string());
    let method = string_field(line, "method").unwrap_or_default();
    let workspace_root = match required_string_field(line, "workspace_root") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };
    let workspace_id = match required_string_field(line, "workspace_id") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };
    let run_id = match required_string_field(line, "run_id") {
        Ok(value) => value,
        Err(error) => return error_response(&id, &error),
    };

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
        "event.append" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let event_type = match required_string_field(line, "event_type") {
                    Ok(value) => value,
                    Err(error) => return error_response(&id, &error),
                };
                let summary = match required_string_field(line, "summary") {
                    Ok(value) => value,
                    Err(error) => return error_response(&id, &error),
                };
                let payload_ref = string_field(line, "payload_ref");
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
        },
        "run.resume.evaluate" => {
            let source = match required_string_field(line, "source") {
                Ok(value) => value,
                Err(error) => return error_response(&id, &error),
            };
            let trigger_id = match required_string_field(line, "trigger_id") {
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
        "tool.evaluate" | "lease.issue" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = match required_string_field(line, "path") {
                    Ok(value) => PathBuf::from(value),
                    Err(error) => return error_response(&id, &error),
                };
                let verb = match required_string_field(line, "verb") {
                    Ok(value) => value,
                    Err(error) => return error_response(&id, &error),
                };
                if verb != "read" && verb != "write" {
                    return error_response(&id, "verb must be read or write");
                }
                let request = if verb == "write" {
                    file_write_request(&run_id, path)
                } else {
                    file_read_request(&run_id, path)
                };
                let consent = if bool_field(line, "approved") {
                    Some(Consent {
                        request_id: request.id.clone(),
                        approved: true,
                    })
                } else {
                    None
                };
                let decision = evaluate_policy(&workspace, &request, consent.as_ref());
                format!(
                    "{{\"request_id\":\"{}\",\"decision\":\"{}\",\"risk_level\":\"{:?}\",\"lease_id\":\"{}\"}}",
                    escape(&decision.request_id),
                    decision_name(&decision.decision),
                    decision.risk_level,
                    escape(decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
                )
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "file.read" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = match required_string_field(line, "path") {
                    Ok(value) => PathBuf::from(value),
                    Err(error) => return error_response(&id, &error),
                };
                let request = file_read_request(&run_id, path);
                let decision = evaluate_policy(&workspace, &request, None);
                match read_with_lease(&request, &decision) {
                    Ok(contents) => format!("{{\"contents\":\"{}\"}}", escape(&contents)),
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
                let path = match required_string_field(line, "path") {
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
                            "{{\"contents\":\"{}\",\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"allow\",\"risk_level\":\"L1\",\"lease_id\":\"{}\"}}",
                            escape(&contents),
                            escape(&request.id),
                            escape(&request_event_id),
                            escape(&decision.id),
                            escape(&policy_event_id),
                            escape(&result_event_id),
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
                            "{{\"request_id\":\"{}\",\"request_event_id\":\"{}\",\"policy_decision_id\":\"{}\",\"policy_event_id\":\"{}\",\"result_event_id\":\"{}\",\"decision\":\"deny\",\"risk_level\":\"L5\",\"lease_id\":\"\",\"reason\":\"{}\"}}",
                            escape(&request.id),
                            escape(&request_event_id),
                            escape(&decision.id),
                            escape(&policy_event_id),
                            escape(&result_event_id),
                            escape(&error.to_string())
                        )
                    }
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "file.write" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = match required_string_field(line, "path") {
                    Ok(value) => PathBuf::from(value),
                    Err(error) => return error_response(&id, &error),
                };
                let contents = match required_string_field(line, "contents") {
                    Ok(value) => value,
                    Err(error) => return error_response(&id, &error),
                };
                let request = file_write_request(&run_id, path);
                let consent = Consent {
                    request_id: request.id.clone(),
                    approved: bool_field(line, "approved"),
                };
                let decision = evaluate_policy(&workspace, &request, Some(&consent));
                match write_with_lease(&request, &decision, &contents) {
                    Ok(()) => format!(
                        "{{\"written\":true,\"request_id\":\"{}\",\"decision\":\"allow\",\"risk_level\":\"L3\",\"lease_id\":\"{}\"}}",
                        escape(&request.id),
                        escape(decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
                    ),
                    Err(error) => return error_response(&id, &error.to_string()),
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "trace.replay" => "{\"live_side_effects_replayed\":false}".to_string(),
        _ => return error_response(&id, "unsupported method"),
    };

    format!(
        "{{\"jsonrpc\":\"2.0\",\"id\":\"{}\",\"result\":{}}}",
        escape(&id),
        response
    )
}

fn required_string_field(line: &str, key: &str) -> Result<String, String> {
    string_field(line, key)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("missing required string field {key}"))
}

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

fn bool_field(line: &str, key: &str) -> bool {
    line.contains(&format!("\"{}\":true", key))
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

    #[test]
    fn rpc_file_write_decodes_json_string_contents() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-json-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("SUMMARY.md");
        let request = format!(
            "{{\"id\":\"rpc_write\",\"method\":\"file.write\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_rpc_test\",\"run_id\":\"run_rpc_test\",\"path\":\"{}\",\"approved\":true,\"contents\":\"line one\\nline \\\"two\\\"\\n\"}}",
            escape(&root.display().to_string()),
            escape(&target.display().to_string())
        );
        let response = handle_rpc_line(&request);
        assert!(response.contains("\"written\":true"));
        assert_eq!(
            fs::read_to_string(target).unwrap(),
            "line one\nline \"two\"\n"
        );
    }

    #[test]
    fn rpc_resume_policy_queues_without_lease_or_auto_execution() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aetherion-rpc-resume-policy-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        let request = format!(
            "{{\"id\":\"rpc_resume\",\"method\":\"run.resume.evaluate\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_resume_test\",\"run_id\":\"run_resume_test\",\"source\":\"manual\",\"trigger_id\":\"wake_resume_test\"}}",
            escape(&root.display().to_string())
        );
        let response = handle_rpc_line(&request);
        assert!(response.contains("\"decision\":\"queue\""));
        assert!(response.contains("\"lease_id\":\"\""));
        assert!(response.contains("\"auto_execute_allowed\":false"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"policy.decided\""));
        assert!(ledger.contains("wake_resume_test"));
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
        let request = format!(
            "{{\"id\":\"rpc_child_read\",\"method\":\"child.file.read\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_child_test\",\"run_id\":\"run_child_test\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            escape(&target.display().to_string())
        );
        let response = handle_rpc_line(&request);
        assert!(response.contains("\"decision\":\"allow\""));
        assert!(response.contains("\"policy_decision_id\":\"policy_"));
        assert!(response.contains("\"lease_id\":\"lease_"));
        assert!(response.contains("\"contents\":\"child evidence\\n\""));
        assert!(response.contains("\"request_event_id\":\"evt_"));
        assert!(response.contains("\"policy_event_id\":\"evt_"));
        assert!(response.contains("\"result_event_id\":\"evt_"));
        let ledger = fs::read_to_string(root.join(".aetherion/events/events.jsonl")).unwrap();
        assert!(ledger.contains("\"event_type\":\"tool.requested\""));
        assert!(ledger.contains("\"event_type\":\"policy.decided\""));
        assert!(ledger.contains("\"event_type\":\"tool.result\""));

        let conflicting_request = format!(
            "{{\"id\":\"rpc_child_read_conflict\",\"method\":\"child.file.read\",\"workspace_root\":\"{}\",\"workspace_id\":\"ws_child_conflict\",\"run_id\":\"run_child_conflict\",\"path\":\"{}\"}}",
            escape(&root.display().to_string()),
            escape(&target.display().to_string())
        );
        let conflict_response = handle_rpc_line(&conflicting_request);
        assert!(conflict_response.contains("\"error\":\"workspace registry identity mismatch\""));
    }
}
