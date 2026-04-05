Stage all unstaged changes and push to GitHub as multiple small, human-style commits.

## Instructions

1. Run `git status` and `git diff --stat` to see all changed files.
2. Run `git diff` on all modified files to understand every change.
3. Group the changes into small, logical commits (3-8 commits typically). Each commit should represent one coherent unit of work, like:
   - A single feature or behavior change
   - A refactor of one component/module
   - A bug fix
   - Config/tooling changes
4. For each group, stage only the relevant files and commit with a human-sounding message:
   - Use lowercase, no conventional-commit prefixes
   - First line: short summary (under 60 chars)
   - Optional body: 1-2 sentences explaining *why*, not *what*
   - Do NOT include Co-Authored-By lines
   - Vary the style slightly — some commits just a single line, some with a body
5. Add any untracked files that belong in the repo. Add files that should be ignored to `.gitignore` instead.
6. After all commits are made, push to the remote.
7. Report the list of commits created.
