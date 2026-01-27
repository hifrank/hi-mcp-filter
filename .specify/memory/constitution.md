<!-- 
SYNC IMPACT REPORT
==================
Version: 0.1.0 → 0.2.0 → 0.2.1 (PATCH)
Ratified: 2026-01-27
Last Amended: 2026-01-27
Status: Updated with local development workflow requirement

Changes:
- v0.2.0: Added Principle VI: Container-First Deployment (AKS/Azure Container App readiness)
- v0.2.0: Added Principle VII: Mandatory Test Coverage per Iteration (unit + integration tests)
- v0.2.1: Expanded Principle VI to include local Docker development workflow requirement

Modified Principles:
- Principle VI: Added local development requirement (Docker Compose/docker run support)

Added Sections:
- VI. Container-First Deployment (v0.2.0)
- VII. Mandatory Test Coverage per Iteration (v0.2.0)

Dependencies requiring validation:
- .specify/templates/plan-template.md: Verify Constitution Check gates include deployment/testing gates
- .specify/templates/tasks-template.md: Task templates should enforce unit+integration tests per iteration
- Local development setup instructions should be included in feature planning

-->

# hi-mcp-filter Constitution

## Core Principles

### I. Specification-Driven Development
Every feature begins with a complete specification document covering user scenarios, test criteria, and acceptance conditions. Specifications must be reviewed and approved before implementation begins. This ensures clear requirements, independent testability, and prevents scope creep. Rationale: Tight specification prevents rework and enables parallel task execution.

### II. Test-First Discipline (NON-NEGOTIABLE)
Tests must be written before implementation code. The Test-Driven Development cycle is mandatory: Write failing tests → Get specification approval → Implement → Tests pass → Refactor. All code must have corresponding test coverage with documented rationale if any code is intentionally untested. Rationale: Tests serve as executable contracts and enable safe refactoring.

### III. Modular Architecture
Features are built as independently deployable modules with clear boundaries. Each module must define its contract (inputs/outputs), dependencies, and public API. Modules must not have organizational-only purposes—every component delivers measurable value. Rationale: Modularity enables parallel development, independent testing, and reusable components.

### IV. MCP Protocol Compliance
All integrations with Model Context Protocol must follow the published MCP specification. Protocol interactions must be thoroughly tested with explicit error handling and recovery paths. Version compatibility must be documented and maintained across releases. Rationale: MCP is the integration boundary; compliance ensures ecosystem reliability.

### V. Progressive Task Decomposition
Complex features are broken into independent phases: Foundation (shared infrastructure), then parallel user story execution. Each user story must be independently implementable, testable, and demonstrable. Tasks are tracked in structured format with explicit dependencies and acceptance criteria. Rationale: Progressive decomposition minimizes blocking dependencies and enables frequent delivery.

### VI. Container-First Deployment
All deliverables MUST be deployable as container images in Azure Kubernetes Service (AKS) or Azure Container Apps. Proxy and all supporting services must include Dockerfile definitions, health check endpoints, and environment-variable-based configuration. Container images must be registry-compatible (Docker/OCI standard). Production readiness includes liveness/readiness probes, resource requests/limits, and graceful shutdown handling. 

**Local Development**: The system MUST be runnable locally using Docker during the development process. Developers must be able to start the entire stack (proxy, backend MCP servers, dependencies) using `docker run` or Docker Compose with minimal configuration. Local Docker setup must mirror production deployment to ensure dev/prod parity. 

Rationale: Container-native deployment ensures consistency, scalability, and cloud-native operational model across environments. Local Docker development eliminates "works on my machine" issues and accelerates iteration cycles.

### VII. Mandatory Test Coverage per Iteration
Every iteration (user story or significant feature increment) MUST include unit tests and integration tests. Unit tests verify individual components/functions in isolation; integration tests verify behavior across module boundaries and against real or mocked external services. Test coverage MUST be measured and reported per iteration; target is 80%+ line coverage for core logic and 100% for critical paths (filtering rules, configuration loading, error handling). Tests are written FIRST, then implementation follows (Test-First Discipline from Principle II). Rationale: Test-per-iteration discipline catches regressions early, documents component contracts, and enables confident refactoring.

## Development Workflow

**Mandatory Workflow**:

1. **Specification Phase**: User provides intent → Clarify & Plan agents create research, design, data model → Specify agent produces formal feature spec with prioritized user stories
2. **Implementation Planning**: Plan agent validates technical context, identifies blocking dependencies → Tasks agent decomposes into independent work items
3. **Implementation Phase**: Features implemented per task list, with test-first discipline and modular boundaries
4. **Quality Gates**: Code must pass linting, all tests, specification compliance check before merge
5. **Documentation**: Each completed feature includes updated docs, API contracts, and deployment notes

**Approval Process**: Feature specifications must be approved before implementation. Breaking changes to established contracts require explicit governance review.

## Specification & Contract Management

All public APIs and protocols must have documented contracts (request/response formats, error codes, behavioral guarantees). Contract changes trigger specification updates and integration testing. Contracts are the source of truth for module boundaries; implementation must conform exactly. Rationale: Explicit contracts enable safe refactoring and parallel development.

## Versioning Policy

This project follows Semantic Versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes to public API or MCP protocol integration
- **MINOR**: New features, new modules, specification changes that extend (not replace) behavior
- **PATCH**: Bug fixes, documentation updates, non-behavioral refinements

Version bumps are documented in CHANGELOG.md with migration guidance for breaking changes.

## Governance

**Constitution Precedence**: This constitution supersedes all informal practices and conventions. In cases of conflict between this document and other guidance, this constitution is binding.

**Amendment Process**: Changes to core principles or governance rules require explicit ratification with documented rationale and impact assessment. Use `/speckit.constitution` command to propose amendments. Amendments must include: updated version number, change summary, affected templates/processes, and migration plan.

**Compliance Review**: All pull requests must verify alignment with active principles. The specification document is the primary compliance artifact; code implementation must satisfy specification requirements. Constitution violations should be flagged during code review before merge.

**Runtime Guidance**: Development happens per patterns established in `.specify/templates/` files and `.github/agents/` decision workflows. These are implementation details; when conflicts arise with constitution principles, constitution governs.

**Version**: 0.2.1 | **Ratified**: 2026-01-27 | **Last Amended**: 2026-01-27
