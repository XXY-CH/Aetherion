use aetherion_supervisor::{
    append_event, evaluate_policy, file_read_request, file_write_request, init_workspace,
    read_with_lease, write_with_lease, Consent, Decision,
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
    let workspace_root = string_field(line, "workspace_root").unwrap_or_else(|| ".".to_string());
    let workspace_id = string_field(line, "workspace_id").unwrap_or_else(|| "ws_rpc".to_string());
    let run_id = string_field(line, "run_id").unwrap_or_else(|| "run_rpc".to_string());

    let response = match method.as_str() {
        "workspace.init" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => format!(
                "{{\"workspace_id\":\"{}\",\"ledger_path\":\"{}\"}}",
                escape(&workspace.id),
                escape(&workspace.ledger_path.display().to_string())
            ),
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "event.append" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let event_type = string_field(line, "event_type").unwrap_or_else(|| "rpc.event".to_string());
                let summary = string_field(line, "summary").unwrap_or_else(|| "RPC event".to_string());
                match append_event(&workspace, &event_type, &run_id, &summary) {
                    Ok(event_id) => format!(
                        "{{\"appended\":true,\"event_id\":\"{}\"}}",
                        escape(&event_id)
                    ),
                    Err(error) => return error_response(&id, &error.to_string()),
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "tool.evaluate" | "lease.issue" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = PathBuf::from(string_field(line, "path").unwrap_or_else(|| workspace_root.clone()));
                let verb = string_field(line, "verb").unwrap_or_else(|| "read".to_string());
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
                    escape(&decision.lease.as_ref().map(|lease| lease.id.as_str()).unwrap_or(""))
                )
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "file.read" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = PathBuf::from(string_field(line, "path").unwrap_or_else(|| workspace_root.clone()));
                let request = file_read_request(&run_id, path);
                let decision = evaluate_policy(&workspace, &request, None);
                match read_with_lease(&request, &decision) {
                    Ok(contents) => format!("{{\"contents\":\"{}\"}}", escape(&contents)),
                    Err(error) => return error_response(&id, &error.to_string()),
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "file.write" => match init_workspace(&workspace_root, &workspace_id) {
            Ok(workspace) => {
                let path = PathBuf::from(string_field(line, "path").unwrap_or_else(|| workspace_root.clone()));
                let contents = string_field(line, "contents").unwrap_or_default();
                let request = file_write_request(&run_id, path);
                let consent = Consent {
                    request_id: request.id.clone(),
                    approved: bool_field(line, "approved"),
                };
                let decision = evaluate_policy(&workspace, &request, Some(&consent));
                match write_with_lease(&request, &decision, &contents) {
                    Ok(()) => "{\"written\":true}".to_string(),
                    Err(error) => return error_response(&id, &error.to_string()),
                }
            }
            Err(error) => return error_response(&id, &error.to_string()),
        },
        "trace.replay" => "{\"live_side_effects_replayed\":false}".to_string(),
        _ => return error_response(&id, "unsupported method"),
    };

    format!("{{\"jsonrpc\":\"2.0\",\"id\":\"{}\",\"result\":{}}}", escape(&id), response)
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
}
