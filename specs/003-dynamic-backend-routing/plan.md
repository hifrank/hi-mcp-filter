# Implementation Plan: Dynamic Backend Routing via Request Header

**Branch**: `003-dynamic-backend-routing` | **Date**: 2026-01-29 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-dynamic-backend-routing/spec.md`

## Summary

Add support for Azure API Management (APIM) to dynamically specify MCP backend targets via the `APIM-PROXIED-MCP-HOST` request header. Enable APIM to delegate requests it cannot process directly to the proxy for advanced filtering. Implement header validation with allowlist-based security (deny-by-default), filter pipeline integration, and comprehensive logging.

**Technical Approach**: Read and validate `APIM-PROXIED-MCP-HOST` header in request handler, check against allowlist, override backend routing decision before forwarding to RequestForwarder. Extend config schema with `dynamicBackendRouting` settings. Integrate with existing filter pipeline - same filters apply regardless of routing source.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x  
**Primary Dependencies**: Fastify 5.x, ajv 8.x (validation), existing proxy infrastructure  
**Storage**: N/A (configuration from JSON files only)  
**Testing**: Jest with 105 existing tests, supertest for integration  
**Target Platform**: Linux server (Docker), macOS (local dev)  
**Project Type**: Single project (Node.js backend service)  

**Performance Goals**: 
  - Header validation + allowlist check <2ms per request
  - Zero latency overhead for static routes (requests without header)
  - Support same throughput as feature 002 (1000 req/s aggregate)

**Constraints**: 
  - Maintain backward compatibility with static-only configs
  - Header precedence over static configuration (explicit rule)
  - Deny-by-default for security (only whitelisted backends allowed)
  - Support both HTTP and SSE transports (transport-agnostic)

**Scale/Scope**: 
  - ~300 LOC new code (header validation, routing logic, config integration)
  - Reuse RequestForwarder from feature 002
  - Reuse filter pipeline from features 001 & 002
  - Extend config schema (MCPServerConfig → add optional dynamicBackendRouting)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Specification-Driven Development

- [x] Feature spec exists: [spec.md](./spec.md) (3 user stories, 11 FRs, 7 success criteria)
- [x] Acceptance criteria defined: Each user story has independent acceptance scenarios
- [x] Compliance: Full compliance

### ✅ Principle II: Test-First Discipline

- [x] Test strategy defined: Unit tests (header parsing, allowlist), integration tests (end-to-end routing), security tests (allowlist enforcement)
- [x] Test cases specified: All 11 FRs require test coverage; Security tests mandatory
- [x] Compliance: Full compliance (tests required for all FRs)

### ✅ Principle III: Modular Architecture

- [x] Clear module boundaries: DynamicBackendResolver (routing logic), AllowlistValidator (security), RoutingMiddleware (request interception)
- [x] Defined contracts: Input (request with header), Output (selected backend URL or error)
- [x] Independent modules: Dynamic routing can be tested independently of static routing
- [x] Compliance: Full compliance (feature integrates cleanly with existing architecture)

### ✅ Principle IV: MCP Protocol Compliance

- [x] MCP JSON-RPC 2.0 format preserved: Dynamic routing is transport-layer only; MCP protocol unmodified
- [x] Protocol testing: Integration tests verify MCP methods work with dynamic backends
- [x] Transport agnostic: Works with HTTP and SSE (features 002 support)
- [x] Compliance: Full compliance (routing is transparent to MCP)

### ✅ Principle V: Progressive Task Decomposition

- [x] Phase structure: Foundation (config schema), then parallel implementation (validation logic, routing logic, filter integration)
- [x] User story independence: US1 (routing), US2 (filters), US3 (security) can develop in parallel after foundation
- [x] Dependency clarity: US3 (security) must complete before production deployment, but US1+US2 can function with relaxed validation
- [x] Compliance: Full compliance (explicit phase structure below)

### ✅ Principle VI: Container-First Deployment

- [x] Container impact: No Dockerfile changes; config externalization via dynamicBackendRouting JSON
- [x] Health endpoints: /health endpoint already exists; dynamic routing status can be exposed
- [x] Graceful shutdown: No new graceful shutdown requirements (reuses existing mechanisms)
- [x] Compliance: Full compliance (no container-specific changes needed)

### ✅ Principle VII: Mandatory Test Coverage per Iteration

- [x] Unit tests: Header parsing, allowlist validation, URL construction (≥80% coverage)
- [x] Integration tests: End-to-end dynamic routing, filter application (≥80% coverage)
- [x] Security tests: Allowlist enforcement, invalid headers (100% critical path coverage)
- [x] Performance tests: <2ms overhead measurement
- [x] Backward compatibility: All existing tests continue to pass (zero regression)
- [x] Compliance: Full compliance (mandatory tests per phase below)

**GATE RESULT: ✅ PASS** - All 7 principles satisfied, no violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/003-dynamic-backend-routing/
├── spec.md                              # Feature specification (user stories, FRs)
├── plan.md                              # This file (implementation plan)
├── checklists/
│   └── requirements.md                  # Spec quality checklist (approved)
├── research.md                          # Phase 0 output (technical decisions) - TO CREATE
├── data-model.md                        # Phase 1 output (entity definitions) - TO CREATE
├── contracts/                           # Phase 1 output (API contracts) - TO CREATE
│   ├── README.md
│   ├── dynamic-routing-endpoint.md
│   └── backend-config.md
└── quickstart.md                        # Phase 1 output (usage guide) - TO CREATE
```

### Source Code (repository root)

```text
src/
├── proxy/
│   ├── routes/
│   │   └── proxy.ts                     # MODIFY: Add header extraction + backend selection
│   ├── forwarder.ts                     # MODIFY: Accept pre-selected backend URL
│   ├── dynamic-routing/                 # NEW DIRECTORY
│   │   ├── resolver.ts                  # NEW: Read and validate header
│   │   ├── allowlist.ts                 # NEW: Allowlist validation logic
│   │   └── selector.ts                  # NEW: Backend selection (header vs config)
│   └── middleware/
│       └── logger.ts                    # MODIFY: Log routing decision source
├── config/
│   ├── schema.ts                        # MODIFY: Add dynamicBackendRouting schema
│   └── validator.ts                     # MODIFY: Validate allowlist, header name
└── types/
    └── config.ts                        # MODIFY: Add DynamicBackendConfig type

tests/
├── unit/
│   ├── proxy/dynamic-routing/           # NEW DIRECTORY
│   │   ├── resolver.test.ts             # NEW: Header parsing tests
│   │   ├── allowlist.test.ts            # NEW: Allowlist validation tests
│   │   └── selector.test.ts             # NEW: Routing selection tests
│   └── config/
│       └── schema.test.ts               # MODIFY: Dynamic routing schema validation
├── integration/
│   ├── dynamic-routing.test.ts          # NEW: End-to-end dynamic routing tests
│   └── sse-proxy.test.ts                # MODIFY: Add dynamic routing + SSE tests (optional)
└── security/
    └── dynamic-routing.test.ts          # NEW: Allowlist enforcement, injection tests

config/
├── default.json                         # MODIFY: Add dynamicBackendRouting example
└── docker.json                          # MODIFY: Add dynamicBackendRouting for Docker
```

## Design Documents

**[protocol-handling-design.md](./protocol-handling-design.md)** — Phase 1 Reference Document
- Complete specification for Rules 1-5: header parsing → URL construction
- Configuration schema with field definitions
- Validation rules, error handling, and error response format
- Performance targets (<2ms overhead) with optimization strategies
- Comprehensive testing strategy with code examples
- **Reference this document when implementing Tasks T008-T016**

---

## Implementation Phases

### Phase 1: Foundation (Shared Infrastructure)

**Purpose**: Config schema and type definitions that block all other work

- [ ] T001 Extend MCPServerConfig type in src/types/config.ts with optional dynamicBackendRouting field
- [ ] T002 Create DynamicBackendConfig type (enabled, headerName, allowlist, denyByDefault, defaultPort)
- [ ] T003 Create AllowlistEntry type (exact hostname, wildcard pattern, IP address)
- [ ] T004 Update config schema in src/config/schema.ts to validate dynamicBackendRouting
- [ ] T005 Validate allowlist entries (exact match, wildcard pattern support, IP range parsing)
- [ ] T006 Validate header name is a valid HTTP header (no spaces, special chars)
- [ ] T007 Update config validator in src/config/validator.ts with dynamic routing validation

**Checkpoint**: Foundation ready - routing implementation can begin in parallel

---

### Phase 2: Core Routing Logic (Blocking Prerequisite)

**Purpose**: Header reading, validation, routing decision logic

- [ ] T008 [P] Create src/proxy/dynamic-routing/resolver.ts - reads APIM-PROXIED-MCP-HOST header
- [ ] T009 [P] Create src/proxy/dynamic-routing/allowlist.ts - validates hostname against allowlist
- [ ] T010 [P] Create src/proxy/dynamic-routing/selector.ts - selects backend (header vs config)
- [ ] T011 [P] Add hostname format validation (DNS name, IP address, port handling)
- [ ] T012 Add whitespace trimming to header values
- [ ] T013 Add hostname normalization (lowercase conversion if needed)
- [ ] T014 Implement allowlist matching with exact match, wildcard, IP range support
- [ ] T015 [P] Create BackendSelection enum (STATIC_CONFIG, HEADER, ERROR)
- [ ] T016 [P] Create RoutingDecision interface (backend URL, selection source, error if any)

**Checkpoint**: Routing logic ready - integration and tests can begin

---

### Phase 3: Integration with Request Handler

**Purpose**: Inject dynamic routing into request processing pipeline

- [ ] T017 Modify src/proxy/routes/proxy.ts to call dynamic routing resolver
- [ ] T018 Extract APIM-PROXIED-MCP-HOST header from request
- [ ] T019 Pass selected backend to RequestForwarder instead of using config directly
- [ ] T020 Handle routing errors (invalid hostname → 400, blocked backend → 403)
- [ ] T021 Add RoutingDecision to request context for logging
- [ ] T022 Ensure backward compatibility: static configs work unchanged

---

### Phase 4: Logging & Observability

**Purpose**: Log routing decisions for debugging and auditing

- [ ] T023 [P] Add routing decision logging in src/proxy/middleware/logger.ts
- [ ] T024 [P] Log backend selection source (STATIC_CONFIG vs HEADER) in request context
- [ ] T025 Log validation errors (invalid hostname, blocked backend)
- [ ] T026 Add metrics for dynamic routing (count by selection source, errors)
- [ ] T027 Ensure no sensitive backend URLs exposed in client error responses

---

### Phase 5: Unit Tests - Header Parsing

**Purpose**: Test header reading and validation logic

- [ ] T028 [P] Create tests/unit/proxy/dynamic-routing/resolver.test.ts
- [ ] T029 [P] Test valid header parsing: "server.example.com"
- [ ] T030 [P] Test header with port: "server.example.com:9000"
- [ ] T031 [P] Test header with whitespace: " server.example.com "
- [ ] T032 [P] Test empty header value: ""
- [ ] T033 [P] Test header absent (returns null)
- [ ] T034 [P] Test header with invalid characters (special chars, spaces)
- [ ] T035 Test header with internationalized domain names (IDN)

**Checkpoint**: Header parsing fully tested

---

### Phase 6: Unit Tests - Allowlist Validation

**Purpose**: Test allowlist enforcement and matching logic

- [ ] T036 [P] Create tests/unit/proxy/dynamic-routing/allowlist.test.ts
- [ ] T037 [P] Test exact hostname match: "server1.example.com" allowed
- [ ] T038 [P] Test exact hostname rejection: "server2.example.com" blocked
- [ ] T039 [P] Test wildcard pattern match: "*.internal.example.com" matches "mcp.internal.example.com"
- [ ] T040 [P] Test wildcard pattern rejection: "*.internal.example.com" blocks "external.com"
- [ ] T041 [P] Test IP address matching (if supported): "192.168.1.100" matches
- [ ] T042 [P] Test IP range matching with CIDR (if supported): "192.168.1.0/24"
- [ ] T043 [P] Test empty allowlist: denies all dynamic routing
- [ ] T044 [P] Test deny-by-default: allowlist not configured → deny

**Checkpoint**: Allowlist validation fully tested

---

### Phase 7: Unit Tests - Routing Selection

**Purpose**: Test backend selection logic (precedence rules)

- [ ] T045 [P] Create tests/unit/proxy/dynamic-routing/selector.test.ts
- [ ] T046 [P] Test header precedence: header overrides static config
- [ ] T047 [P] Test fallback: no header → use static config
- [ ] T048 [P] Test missing backend: no header AND no config → error
- [ ] T049 [P] Test routing decision object construction
- [ ] T050 [P] Test selection source logging (STATIC_CONFIG vs HEADER)

**Checkpoint**: Routing selection logic fully tested

---

### Phase 8: Integration Tests

**Purpose**: End-to-end dynamic routing with real request/response flow

- [ ] T051 [P] Create tests/integration/dynamic-routing.test.ts
- [ ] T052 Send request with valid APIM-PROXIED-MCP-HOST header
- [ ] T053 Verify request forwarded to specified backend
- [ ] T054 Verify response returned to client correctly
- [ ] T055 Test with both HTTP and SSE backends
- [ ] T056 Test filter application with dynamic routing
- [ ] T057 Test error response for invalid hostname (400)
- [ ] T058 Test error response for blocked hostname (403)
- [ ] T059 Test backward compatibility: request without header uses static config
- [ ] T060 Test request correlation: response ID matches request ID through dynamic backend

**Checkpoint**: End-to-end integration fully tested

---

### Phase 9: Security Tests

**Purpose**: Validate security constraints (allowlist enforcement, header injection)

- [ ] T061 [P] Create tests/security/dynamic-routing.test.ts
- [ ] T062 [P] Test allowlist enforcement: blocked backend returns 403
- [ ] T063 [P] Test deny-by-default: unallowlisted backend returns 403
- [ ] T064 [P] Test header injection: special characters in hostname rejected
- [ ] T065 [P] Test URL-encoded injection attacks
- [ ] T066 Test header spoofing: cannot override with additional headers
- [ ] T067 Test routing doesn't expose internal backend URLs to client errors

**Checkpoint**: Security constraints validated

---

### Phase 10: Config Schema Tests

**Purpose**: Validate configuration parsing and schema compliance

- [ ] T068 [P] Extend tests/unit/config/schema.test.ts with dynamicBackendRouting
- [ ] T069 [P] Test valid dynamicBackendRouting config
- [ ] T070 [P] Test invalid allowlist entries (rejected)
- [ ] T071 [P] Test missing allowlist (defaults to empty/deny)
- [ ] T072 [P] Test header name validation
- [ ] T073 [P] Test denyByDefault flag

**Checkpoint**: Config validation fully tested

---

### Phase 11: Polish & Documentation

**Purpose**: Documentation, examples, and final integration

- [ ] T074 [P] Create docs/dynamic-routing.md with feature overview
- [ ] T075 Create example configuration in config/docker.json
- [ ] T076 Create example request/response in examples/
- [ ] T077 Update README.md with dynamic routing section
- [ ] T078 Update API documentation with routing flow diagram
- [ ] T079 Add performance baseline: measure <2ms overhead
- [ ] T080 Run full test suite and verify zero regression
- [ ] T081 Verify backward compatibility: HTTP-only configs work unchanged

**Checkpoint**: All documentation and examples complete

---

### Phase 12: Performance & Validation

**Purpose**: Performance testing and final acceptance validation

- [ ] T082 Performance test: measure header parsing + allowlist check latency
- [ ] T083 Verify <2ms per-request overhead
- [ ] T084 Memory usage test: no leaks with 1000 dynamic routing requests
- [ ] T085 Concurrent dynamic routing test: verify thread-safety
- [ ] T086 Measure throughput impact: verify no regression from 1000 req/s baseline
- [ ] T087 Verify SC-001: routing to specified backend works
- [ ] T088 Verify SC-002: allowlist prevents unauthorized backends
- [ ] T089 Verify SC-003: static routes have zero overhead
- [ ] T090 Verify SC-004: filters applied uniformly
- [ ] T091 Verify SC-005: <2ms overhead
- [ ] T092 Verify SC-006: logging complete for 100% of requests
- [ ] T093 Verify SC-007: zero regression (all existing tests pass)

---

## Dependencies

### Task Execution Order

```
Phase 1 (Foundation)
        ↓
    Phase 2 (Core Logic)
        ↓
    ┌─────────────────┬─────────────────┬──────────────┐
    ↓                 ↓                 ↓              ↓
Phase 3 (Integration) Phase 5-7 (Unit Tests) Phase 9 (Security) Phase 10 (Config)
    ↓                 ↓                 ↓              ↓
    └─────────────────┴─────────────────┴──────────────┘
            ↓
        Phase 4 (Logging)
            ↓
        Phase 8 (Integration)
            ↓
        Phase 11 (Polish)
            ↓
        Phase 12 (Validation)
```

**Blocking Dependencies**:
- Phase 1 MUST complete before any other phase
- Phase 2 MUST complete before Phase 3, 4, 8
- Phase 3 MUST complete before Phase 8
- Phase 5-10 can develop in parallel after Phase 2

**Parallel Opportunities**:
- Phase 5-7 (unit tests) can run in parallel after Phase 2
- Phase 9 (security tests) can run in parallel with Phase 5-7
- Phase 10 (config tests) can run in parallel with Phase 5-7

---

## Task Summary

- **Total Tasks**: 93
- **Foundation Tasks**: 7 (T001-T007)
- **Core Logic Tasks**: 9 (T008-T016)
- **Integration Tasks**: 6 (T017-T022)
- **Logging Tasks**: 5 (T023-T027)
- **Unit Tests - Header**: 8 (T028-T035)
- **Unit Tests - Allowlist**: 9 (T036-T044)
- **Unit Tests - Selection**: 6 (T045-T050)
- **Integration Tests**: 10 (T051-T060)
- **Security Tests**: 7 (T061-T067)
- **Config Tests**: 6 (T068-T073)
- **Polish Tasks**: 8 (T074-T081)
- **Performance Tasks**: 12 (T082-T093)

**Parallel Opportunities**: 43 tasks can run in parallel (marked with [P])

**MVP Task Count**: Phase 1 + 2 + 3 + 4 + 8 = 30 tasks (core feature complete)

---

## Success Validation Checklist

After completing all tasks, verify:

- [ ] All dynamic routing requests with valid headers route correctly (SC-001)
- [ ] Allowlist prevents routing to non-whitelisted backends (SC-002)
- [ ] Requests without header route to static config with zero latency overhead (SC-003)
- [ ] Filters are applied to dynamic routed responses uniformly (SC-004)
- [ ] Header validation overhead is <2ms per request (SC-005)
- [ ] 100% of routing decisions are logged with source indication (SC-006)
- [ ] All 105 existing tests continue to pass (SC-007, zero regression)
- [ ] Performance baseline maintained (1000 req/s aggregate throughput)
- [ ] No security vulnerabilities in allowlist enforcement
- [ ] All edge cases handled correctly
