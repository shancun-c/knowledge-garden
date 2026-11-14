# Repository boundaries

- This is the single source repository for development and GitHub publication. Do not maintain a separate public copy.
- Keep production configuration, secrets, user data, screenshots, operational records and private deployment scripts outside the repository. Only sanitized examples belong here.
- Local sibling `private/` and `backups/` directories are not source inputs and must never be added to Git or uploaded. Do not merge archived private Git history into this repository.
- Follow `docs/development.md` for checks and publication. Publishing source does not authorize production deployment.
- Before editing, inspect existing code, identify scope and acceptance criteria, and preserve unrelated work. Use version-matched documentation for changes to external API usage; do not query documentation merely to move unchanged code.
- Verify relevant tests, TypeScript and the self-hosted build for substantive changes. Report any unverified behavior honestly.
