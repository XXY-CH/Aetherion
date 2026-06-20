// Subagent branch isolation — runs a child agent in a branch worktree
// so its file mutations don't affect the main workspace.
//
// The parent agent can then review the worktree diff and decide whether
// to merge the changes into the main workspace or discard the branch.

import { join } from "node:path";
import { captureTreeSnapshot } from "./tree-snapshot.ts";
import {
  createBranch,
  getBranchHead,
  branchWorkspace,
  type BranchHead
} from "./branch.ts";

export type SubagentBranchInput = {
  workspaceRoot: string;
  branchName: string;
  sourceTreeHash: string;
  task: string;
  repoRoot: string;
};

export type SubagentBranchResult = {
  branchName: string;
  worktreeTreeHash: string;
  branchHead: BranchHead;
  output: string;
  merged: false; // explicitly false — merge is a separate explicit step
};

// Create a branch worktree for a child agent.
// The child agent will run in the worktree directory, isolated from the main workspace.
// The actual agent loop execution is left to the caller (the agent-loop.ts agent_spawn
// path), which uses branchWorkspace() to get the worktree path.
//
// This function creates the branch and captures the initial worktree state.
// After the child agent completes, the caller captures the final worktree state
// for diff/merge review.
export async function runSubagentInBranch(input: SubagentBranchInput): Promise<SubagentBranchResult> {
  // Create the branch with a physical workspace copy
  const branchInfo = createBranch(
    input.workspaceRoot,
    input.branchName,
    input.sourceTreeHash,
    "main"
  );

  // Capture the initial worktree tree hash (should match source)
  const wtDir = branchWorkspace(input.workspaceRoot, input.branchName);
  const wtSnap = captureTreeSnapshot(wtDir);

  // Get branch head for the result
  const head = getBranchHead(input.workspaceRoot, input.branchName);
  if (!head) {
    throw new Error(`Failed to get branch head for '${input.branchName}'`);
  }

  return {
    branchName: input.branchName,
    worktreeTreeHash: wtSnap.tree_hash,
    branchHead: head,
    output: `Subagent branch '${input.branchName}' created. Task: ${input.task}`,
    merged: false
  };
}
