# Contributing

This repository includes a GitHub Actions workflow that runs tests on pushes to `main` and on pull requests targeting `main`.

CI workflow: `.github/workflows/ci.yml`

To prevent merging into `main` unless all tests pass, enable a branch protection rule in GitHub:

1. Open your repository on GitHub -> Settings -> Branches -> Branch protection rules -> Add rule.
2. Set the branch name pattern to `main`.
3. Check **Require status checks to pass before merging**.
4. Select the status check created by this workflow (it will appear after the workflow runs at least once). The check is the `Run tests` job from the `CI` workflow.
5. (Optional) Enable **Require pull request reviews before merging** and **Include administrators**.

After enabling the rule, merges into `main` will be blocked until the CI workflow completes successfully.

## Notes

- The workflow uses `pnpm` (see `pnpm-lock.yaml`) and runs `pnpm test`.
- If you want automatic merging when checks pass and approvals are present, enable GitHub's built-in auto-merge for pull requests or add an auto-merge action (optional).
