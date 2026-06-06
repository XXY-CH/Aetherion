use aetherion_supervisor::{
    append_event, evaluate_policy, file_read_request, init_workspace, read_with_lease,
};
use std::env;
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
        _ => {
            println!("Usage: aetherion-supervisor read <workspace-root> <file-path>");
            Ok(())
        }
    }
}
