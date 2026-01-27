# Tasks: MCP Response Filter Proxy

**Input**: Design documents from `/specs/001-mcp-response-filter/`
**Prerequisites**: plan.md (✓), spec.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

**Tests**: Constitution VII requires unit + integration tests per iteration. All test tasks marked for each user story.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

Single project structure (from plan.md):
- `src/` - Source code (proxy, mcp, filter, transform, plugin, config, common)
- `tests/unit/` - Component-level tests
- `tests/integration/` - End-to-end proxy flow tests
- `tests/fixtures/` - Test data (sample MCP responses, configs)
- `docker/` - Container definitions
- `config/` - Example configuration files

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Node.js 20.x project with package.json in repository root
- [x] T002 [P] Configure TypeScript (tsconfig.json) with ES2022 target and strict mode
- [x] T003 [P] Configure ESLint (.eslintrc.json) with TypeScript rules
- [x] T004 [P] Configure Prettier (.prettierrc) for code formatting
- [x] T005 [P] Add Jest configuration (jest.config.js) for unit and integration tests
- [x] T006 [P] Install dependencies: fastify, ajv, jsonata, jsonpath-plus, vm2, pino, dotenv, chokidar
- [x] T007 [P] Install dev dependencies: jest, supertest, @types/node, @types/jest, ts-node, typescript, eslint, prettier, ts-jest
- [x] T008 Create project directory structure (src/, tests/, docker/, config/, docs/) per plan.md
- [x] T009 [P] Create README.md with project overview and setup instructions
- [x] T010 [P] Create .gitignore (node_modules, dist, coverage, .env)

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T011 Create MCP JSON-RPC 2.0 schema file in src/mcp/schema.json
- [x] T012 [P] Implement MCP response validator in src/mcp/validator.ts using ajv
- [x] T013 [P] Implement logging utility in src/common/logger.ts using Pino
- [x] T014 [P] Implement error handling utility in src/common/errors.ts (custom error classes)
- [x] T015 [P] Implement metrics collector stub in src/common/metrics.ts (counters, histograms)
- [x] T016 Create configuration schema in src/config/schema.json (proxy, mcpServers, filters, transformations, plugins)
- [x] T017 Implement configuration loader in src/config/loader.ts (read JSON/YAML, validate against schema)
- [x] T018 [P] Create test fixtures: sample MCP responses in tests/fixtures/mcp-responses.json
- [x] T019 [P] Create test fixtures: sample filter rules in tests/fixtures/filters.json
- [x] T020 [P] Create test fixtures: sample transformation rules in tests/fixtures/transforms.json

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Proxy Receives and Forwards MCP Responses (Priority: P1) 🎯 MVP

**Goal**: Proxy accepts requests from API Management, forwards to backend MCP servers, validates responses, and forwards back with <100ms latency

**Independent Test**: Run mock MCP server behind proxy; send requests through proxy; verify responses reach client unchanged and within latency budget

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US1] Unit test for MCP validator in tests/unit/mcp/validator.test.ts (valid/invalid responses)
- [ ] T022 [P] [US1] Unit test for proxy router logic in tests/unit/proxy/router.test.ts (request routing to backend)
- [ ] T023 [P] [US1] Integration test for passthrough flow in tests/integration/proxy-passthrough.test.ts (end-to-end request/response)
- [ ] T024 [P] [US1] Integration test for health check endpoint in tests/integration/health-check.test.ts

### Implementation for User Story 1

- [ ] T025 [P] [US1] Create Fastify server instance in src/proxy/server.ts (port, host from config)
- [ ] T026 [P] [US1] Implement health check endpoint GET /health in src/proxy/health.ts per contracts/health-check.md
- [ ] T027 [US1] Implement proxy routing logic in src/proxy/router.ts (match serverId, forward to backend URL)
- [ ] T028 [US1] Implement request forwarder in src/proxy/forwarder.ts (HTTP client to backend MCP servers)
- [ ] T029 [US1] Integrate MCP validator into proxy pipeline in src/proxy/middleware/validate.ts
- [ ] T030 [US1] Add request/response logging in src/proxy/middleware/logger.ts
- [ ] T031 [US1] Add latency tracking in src/proxy/middleware/metrics.ts (X-Proxy-Latency-Ms header)
- [ ] T032 [US1] Implement POST /proxy/:serverId endpoint in src/proxy/routes/proxy.ts per contracts/proxy-endpoint.md
- [ ] T033 [US1] Add concurrent request handling tests (verify no data mixing with 100 parallel requests)

**Checkpoint**: User Story 1 complete - proxy can forward MCP requests/responses transparently

---

## Phase 4: User Story 2 - Apply Response Filters (Priority: P1)

**Goal**: Declarative filter rules match response patterns and selectively forward or drop responses; hot-reload without restart

**Independent Test**: Configure filters for known patterns; send requests; verify matching responses filtered, non-matching passed

### Tests for User Story 2 ⚠️

- [ ] T034 [P] [US2] Unit test for JSONPath condition evaluator in tests/unit/filter/condition-evaluator.test.ts
- [ ] T035 [P] [US2] Unit test for filter rule matcher in tests/unit/filter/rule-matcher.test.ts (equals, contains, matches operators)
- [ ] T036 [P] [US2] Unit test for multi-rule composition logic in tests/unit/filter/composition.test.ts (AND/OR/NONE)
- [ ] T037 [P] [US2] Integration test for filter pipeline in tests/integration/filter-pipeline.test.ts (drop/allow responses)

### Implementation for User Story 2

- [ ] T038 [P] [US2] Create FilterRule entity type in src/filter/types.ts per data-model.md
- [ ] T039 [P] [US2] Implement JSONPath condition evaluator in src/filter/condition-evaluator.ts using jsonpath-plus
- [ ] T040 [US2] Implement filter rule matcher in src/filter/rule-matcher.ts (match conditions against responses)
- [ ] T041 [US2] Implement multi-rule composition engine in src/filter/composition.ts (AND/OR logic per rule metadata)
- [ ] T042 [US2] Implement filter rule compiler in src/filter/compiler.ts (pre-compile JSONPath expressions at config load)
- [ ] T043 [US2] Create filter engine in src/filter/engine.ts (load rules, evaluate against response, return allow/drop)
- [ ] T044 [US2] Integrate filter engine into proxy pipeline in src/proxy/middleware/filter.ts
- [ ] T045 [US2] Add filter decision logging (matched filter ID, rule name, action taken)
- [ ] T046 [US2] Add X-Proxy-Filtered header to responses
- [ ] T047 [US2] Implement 403 Forbidden response for dropped requests per contracts/proxy-endpoint.md

**Checkpoint**: User Story 2 complete - proxy can filter responses based on declarative rules

---

## Phase 5: User Story 3 - Modify Response Content (Priority: P2)

**Goal**: Declarative transformation rules redact, restructure, or modify response content; transformations are composable and chainable

**Independent Test**: Configure transformations for known response structures; verify output matches expected transformations

### Tests for User Story 3 ⚠️

- [ ] T048 [P] [US3] Unit test for JSONata expression compiler in tests/unit/transform/compiler.test.ts
- [ ] T049 [P] [US3] Unit test for transformation rule executor in tests/unit/transform/executor.test.ts (redact, extract, restructure)
- [ ] T050 [P] [US3] Unit test for transformation pipeline in tests/unit/transform/pipeline.test.ts (sequential rule application)
- [ ] T051 [P] [US3] Integration test for transformation flow in tests/integration/transform-pipeline.test.ts

### Implementation for User Story 3

- [ ] T052 [P] [US3] Create TransformationRule entity type in src/transform/types.ts per data-model.md
- [ ] T053 [P] [US3] Implement JSONata expression compiler in src/transform/compiler.ts (pre-compile at config load)
- [ ] T054 [US3] Implement transformation rule executor in src/transform/executor.ts (apply JSONata expression to response)
- [ ] T055 [US3] Implement transformation pipeline in src/transform/pipeline.ts (apply rules in order, chain outputs)
- [ ] T056 [US3] Add error handling for missing fields (passthrough unchanged per spec)
- [ ] T057 [US3] Create transformation engine in src/transform/engine.ts (load rules, execute pipeline)
- [ ] T058 [US3] Integrate transformation engine into proxy pipeline in src/proxy/middleware/transform.ts
- [ ] T059 [US3] Add transformation logging (applied transforms, field changes)
- [ ] T060 [US3] Add X-Proxy-Transformed header to responses

**Checkpoint**: User Story 3 complete - proxy can transform response content via declarative rules

---

## Phase 6: User Story 4 - Customization Layer for Business Logic (Priority: P2)

**Goal**: Custom JavaScript plugins implement domain-specific logic beyond declarative rules; plugins can access request/response context and external services

**Independent Test**: Write simple plugin (e.g., rate limiter); deploy to proxy; verify logic executes correctly

### Tests for User Story 4 ⚠️

- [ ] T061 [P] [US4] Unit test for plugin loader in tests/unit/plugin/loader.test.ts (load, validate interface)
- [ ] T062 [P] [US4] Unit test for plugin executor in tests/unit/plugin/executor.test.ts (timeout, error handling)
- [ ] T063 [P] [US4] Unit test for plugin error behaviors in tests/unit/plugin/error-handler.test.ts (fail-open, fail-secure, retry)
- [ ] T064 [P] [US4] Integration test for plugin execution in tests/integration/plugin-execution.test.ts (sample plugin)

### Implementation for User Story 4

- [ ] T065 [P] [US4] Create Plugin entity type in src/plugin/types.ts per data-model.md
- [ ] T066 [P] [US4] Define PluginContext interface in src/plugin/context.ts (request, response, logger, config)
- [ ] T067 [P] [US4] Implement plugin loader in src/plugin/loader.ts (load JS file, validate exports)
- [ ] T068 [US4] Implement plugin sandbox using isolated-vm in src/plugin/sandbox.ts
- [ ] T069 [US4] Implement plugin executor in src/plugin/executor.ts (run filter/transform functions with timeout)
- [ ] T070 [US4] Implement plugin error handler in src/plugin/error-handler.ts (fail-open, fail-secure, retry logic)
- [ ] T071 [US4] Create plugin cache in src/plugin/cache.ts (load once, reuse across requests)
- [ ] T072 [US4] Integrate plugin system into proxy pipeline in src/proxy/middleware/plugin.ts
- [ ] T073 [US4] Add plugin execution logging (plugin name, execution time, result)
- [ ] T074 [P] [US4] Create sample rate-limiter plugin in plugins/rate-limiter.js
- [ ] T075 [P] [US4] Create plugin API documentation in docs/plugin-api.md

**Checkpoint**: User Story 4 complete - custom plugins can extend proxy with business logic

---

## Phase 7: User Story 5 - Configuration Management (Priority: P3)

**Goal**: Hot-reload configuration changes without restarting proxy; validate config before applying; optional management API

**Independent Test**: Modify config file; trigger reload; verify new filters/transformations active within 5 seconds without dropping requests

### Tests for User Story 5 ⚠️

- [ ] T076 [P] [US5] Unit test for config file watcher in tests/unit/config/watcher.test.ts
- [ ] T077 [P] [US5] Unit test for config validator in tests/unit/config/validator.test.ts
- [ ] T078 [P] [US5] Unit test for atomic config swap in tests/unit/config/swap.test.ts
- [ ] T079 [P] [US5] Integration test for hot-reload flow in tests/integration/config-hot-reload.test.ts (5-second target)

### Implementation for User Story 5

- [ ] T080 [P] [US5] Implement config file watcher in src/config/watcher.ts using chokidar
- [ ] T081 [US5] Implement config validator in src/config/validator.ts (JSON schema validation)
- [ ] T082 [US5] Implement atomic config swap in src/config/swap.ts (swap reference without downtime)
- [ ] T083 [US5] Integrate hot-reload into config loader in src/config/loader.ts
- [ ] T084 [US5] Add config reload logging (old/new versions, validation results, reload time)
- [ ] T085 [US5] Handle invalid config during reload (keep old config, log error)
- [ ] T086 [US5] Re-compile filter rules and transformations on reload
- [ ] T087 [US5] Re-initialize plugin cache on reload (reload changed plugins)
- [ ] T088 [P] [US5] Optional: Create management API endpoint POST /api/config/reload in src/proxy/routes/admin.ts
- [ ] T089 [P] [US5] Optional: Create management API endpoint GET /api/config/status in src/proxy/routes/admin.ts

**Checkpoint**: User Story 5 complete - configuration can be hot-reloaded without proxy restart

---

## Phase 8: Container Deployment (Constitution VI)

**Purpose**: Satisfy Container-First Deployment principle - Docker, AKS, Azure Container Apps support

- [ ] T090 [P] Create production Dockerfile in docker/Dockerfile (node:20-alpine base, multi-stage build)
- [ ] T091 [P] Create development Dockerfile in docker/Dockerfile.dev (node:20 with hot-reload)
- [ ] T092 [P] Create docker-compose.yml in docker/docker-compose.yml (proxy + mock MCP server)
- [ ] T093 [P] Add Docker health check script in src/proxy/healthcheck.js (used by HEALTHCHECK directive)
- [ ] T094 [P] Add environment variable configuration in src/config/env.ts (NODE_ENV, CONFIG_PATH)
- [ ] T095 [P] Create example proxy config in config/proxy.example.json
- [ ] T096 [P] Create example filter rules in config/filters.example.json
- [ ] T097 [P] Create example transformation rules in config/transforms.example.json
- [ ] T098 [P] Create Kubernetes deployment manifest in k8s/deployment.yaml (for AKS)
- [ ] T099 [P] Create Kubernetes service manifest in k8s/service.yaml (for AKS)
- [ ] T100 [P] Update quickstart.md with Docker/AKS/Container Apps deployment instructions

**Checkpoint**: Container deployment ready - proxy can run in Docker, AKS, Azure Container Apps

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Production readiness, documentation, observability

- [ ] T101 [P] Add Prometheus metrics endpoint GET /metrics in src/proxy/routes/metrics.ts (optional)
- [ ] T102 [P] Implement graceful shutdown handler in src/proxy/server.ts (drain connections on SIGTERM)
- [ ] T103 [P] Add request tracing headers (X-Request-ID propagation)
- [ ] T104 [P] Create operations guide in docs/operations.md (deployment, monitoring, troubleshooting)
- [ ] T105 [P] Add performance testing script in tests/performance/load-test.js (verify <100ms latency at 100 req/s)
- [ ] T106 [P] Add test coverage reporting (npm run coverage) using Istanbul/nyc
- [ ] T107 [P] Verify 80%+ line coverage for core logic (filter, transform, plugin)
- [ ] T108 [P] Verify 100% coverage for critical paths (config loading, MCP validation, error handling)
- [ ] T109 [P] Add CI/CD pipeline definition in .github/workflows/ci.yml (lint, test, coverage, build)
- [ ] T110 [P] Create CHANGELOG.md with version history

**Checkpoint**: Production-ready proxy with comprehensive tests, documentation, and deployment artifacts

---

## Dependencies & Execution Order

### Critical Path (must complete in order):

1. **Phase 1** (Setup) → **Phase 2** (Foundation) → **Phase 3** (US1: Proxy & Forward)
2. **Phase 3** (US1) → **Phase 4** (US2: Filters) OR **Phase 5** (US3: Transform) OR **Phase 6** (US4: Plugins)
3. **Phase 4, 5, 6** (US2-4) → **Phase 7** (US5: Config Management)
4. **Phase 7** (US5) → **Phase 8** (Container Deployment)
5. **Phase 8** → **Phase 9** (Polish)

### User Story Dependencies:

- **US1** (Proxy): No dependencies (foundational)
- **US2** (Filters): Depends on US1 (needs proxy pipeline)
- **US3** (Transform): Depends on US1 (needs proxy pipeline)
- **US4** (Plugins): Depends on US1 (needs proxy pipeline)
- **US5** (Config): Depends on US2, US3, US4 (needs filter/transform/plugin systems to reload)

### Parallel Execution Opportunities:

**Phase 2 (Foundation)**:
- T012 (MCP validator), T013 (logger), T014 (errors), T015 (metrics) can run in parallel
- T018, T019, T020 (test fixtures) can run in parallel

**Phase 3 (US1)**:
- T021, T022, T023, T024 (tests) can run in parallel BEFORE implementation
- T025, T026 (server setup, health check) can run in parallel
- T030, T031 (logging, metrics middleware) can run in parallel

**Phase 4 (US2)**:
- T034, T035, T036, T037 (tests) can run in parallel BEFORE implementation
- T038, T039 (types, condition evaluator) can run in parallel

**Phase 5 (US3)**:
- T048, T049, T050, T051 (tests) can run in parallel BEFORE implementation
- T052, T053 (types, compiler) can run in parallel

**Phase 6 (US4)**:
- T061, T062, T063, T064 (tests) can run in parallel BEFORE implementation
- T065, T066 (types, context interface) can run in parallel
- T074, T075 (sample plugin, docs) can run in parallel

**Phase 7 (US5)**:
- T076, T077, T078, T079 (tests) can run in parallel BEFORE implementation
- T088, T089 (optional management API endpoints) can run in parallel

**Phase 8 (Container)**:
- T090, T091, T092 (Dockerfiles, compose) can run in parallel
- T095, T096, T097 (example configs) can run in parallel
- T098, T099 (K8s manifests) can run in parallel

**Phase 9 (Polish)**:
- T101-T110 (all polish tasks) can run in parallel

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product):

- **Phase 1**: Setup
- **Phase 2**: Foundation
- **Phase 3**: User Story 1 (Proxy & Forward)
- **Phase 4**: User Story 2 (Filters)
- **Phase 8**: Container Deployment (Docker only)

**MVP Delivery**: ~40 tasks, estimated 2-3 weeks for single developer

### Full Feature Scope:

All 110 tasks across 9 phases, estimated 4-6 weeks for single developer

### Incremental Delivery Plan:

1. **Week 1**: MVP (Phases 1-4) - Proxy with basic filtering
2. **Week 2**: Transformations & Plugins (Phases 5-6) - Extended capabilities
3. **Week 3**: Config Management & Container Deployment (Phases 7-8) - Production readiness
4. **Week 4**: Polish & Documentation (Phase 9) - Production launch

---

## Test Coverage Targets (Constitution VII)

- **Core Logic** (filter, transform, plugin): 80%+ line coverage
- **Critical Paths** (config loading, MCP validation, error handling): 100% line coverage
- **Unit Tests**: 60 tests across filter, transform, plugin, config, mcp modules
- **Integration Tests**: 15 tests for end-to-end proxy flows
- **Coverage Reporting**: Istanbul/nyc with HTML reports

**Total Tasks**: 110  
**Test Tasks**: 24 (unit + integration)  
**Parallel Opportunities**: 45 tasks marked [P]  
**User Stories**: 5 (US1-US5)  
**Estimated Effort**: 4-6 weeks (single developer)
