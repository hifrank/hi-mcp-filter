---
description: "Task list for Dynamic Backend Routing via Request Header"
---

# Tasks: Dynamic Backend Routing via Request Header

**Input**: Design documents from `/specs/003-dynamic-backend-routing/`
**Prerequisites**: plan.md, spec.md, protocol-handling-design.md

**Tech Stack**: TypeScript 5.x, Node.js 20.x, Fastify 5.x, Jest, ajv 8.x
**Project Type**: Single project (Node.js backend service)

**Tests**: Tests are included per the specification requirements (all 11 FRs require test coverage)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are relative to repository root:
- Source: `src/`
- Tests: `tests/`
- Config: `config/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and configuration schema

- [ ] T001 Extend MCPServerConfig type in src/types/config.ts with optional dynamicBackendRouting field
- [ ] T002 [P] Create DynamicBackendConfig type (enabled, headerName, allowlist, denyByDefault, defaultPort) in src/types/config.ts
- [ ] T003 [P] Create AllowlistEntry type (exact hostname, wildcard pattern, IP address) in src/types/config.ts
- [ ] T004 Update config schema in src/config/schema.ts to validate dynamicBackendRouting section
- [ ] T005 [P] Create src/proxy/dynamic-routing/ directory structure
- [ ] T006 [P] Create BackendSelection enum (STATIC_CONFIG, HEADER, ERROR) in src/types/config.ts
- [ ] T007 [P] Create RoutingDecision interface (backend URL, selection source, error) in src/types/config.ts

**Checkpoint**: Foundation complete - core feature development can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Update config validator in src/config/validator.ts with dynamic routing validation
- [ ] T009 [P] Validate allowlist entries (exact match, wildcard pattern support, IP range parsing) in src/config/validator.ts
- [ ] T010 [P] Validate header name is a valid HTTP header (no spaces, special chars) in src/config/validator.ts
- [ ] T011 Add configuration examples in config/default.json with dynamicBackendRouting section (include minimal example with empty allowlist and full example with wildcards, exact matches, comments explaining each field per spec.md configuration schema)
- [ ] T012 [P] Add configuration examples in config/docker.json with dynamicBackendRouting section (production-ready example with allowlist patterns)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - APIM Delegates Requests via Header (Priority: P1) 🎯 MVP

**Goal**: Enable proxy to route requests to backends specified via APIM-PROXIED-MCP-HOST header

**Independent Test**: Send request to proxy with `APIM-PROXIED-MCP-HOST: custom-mcp-server.example.com` header, verify proxy routes request to that backend hostname

**Success Criteria**: 
- SC-001: Proxy routes requests with valid header to specified backend
- SC-003: Backward compatibility - requests without header route to configured backend

### Implementation for User Story 1

- [ ] T013 [P] [US1] Create src/proxy/dynamic-routing/resolver.ts - reads APIM-PROXIED-MCP-HOST header
- [ ] T014 [P] [US1] Implement parseBackendHostHeader() function (extract hostname, port from header per protocol-handling-design.md Rule 1)
- [ ] T015 [P] [US1] Implement determinePort() function (explicit > config > 443 default per protocol-handling-design.md Rule 2)
- [ ] T016 [P] [US1] Implement determineProtocol() function (always HTTPS for MVP per protocol-handling-design.md Rule 3)
- [ ] T017 [P] [US1] Implement determineTransport() function (config > auto-detect > HTTP default per protocol-handling-design.md Rule 4)
- [ ] T018 [P] [US1] Implement constructBackendUrl() function (assemble full URL per protocol-handling-design.md Rule 5)
- [ ] T019 [P] [US1] Create src/proxy/dynamic-routing/selector.ts - selects backend (header vs config precedence)
- [ ] T020 [US1] Add hostname format validation (DNS name, IP address, port handling) in resolver.ts
- [ ] T021 [US1] Add whitespace trimming to header values in resolver.ts
- [ ] T022 [US1] Add hostname normalization (lowercase conversion) in resolver.ts
- [ ] T023 [US1] Modify src/proxy/routes/proxy.ts to call dynamic routing resolver
- [ ] T024 [US1] Extract APIM-PROXIED-MCP-HOST header from request in proxy.ts
- [ ] T025 [US1] Pass selected backend to RequestForwarder instead of using config directly
- [ ] T026 [US1] Handle routing errors (invalid hostname → 400, validation errors)
- [ ] T027 [US1] Add RoutingDecision to request context for logging
- [ ] T028 [US1] Ensure backward compatibility: static configs work unchanged (fallback logic)

### Tests for User Story 1

- [ ] T029 [P] [US1] Create tests/unit/proxy/dynamic-routing/resolver.test.ts
- [ ] T030 [P] [US1] Test valid header parsing: "server.example.com"
- [ ] T031 [P] [US1] Test header with port: "server.example.com:9000"
- [ ] T032 [P] [US1] Test header with whitespace: " server.example.com "
- [ ] T033 [P] [US1] Test empty header value: "" (should fallback to config)
- [ ] T034 [P] [US1] Test header absent (returns null, uses config)
- [ ] T035 [P] [US1] Test header with invalid characters (special chars, spaces)
- [ ] T036 [P] [US1] Test header with internationalized domain names (IDN)
- [ ] T037 [P] [US1] Create tests/unit/proxy/dynamic-routing/selector.test.ts
- [ ] T038 [P] [US1] Test header precedence: header overrides static config
- [ ] T039 [P] [US1] Test fallback: no header → use static config
- [ ] T040 [P] [US1] Test missing backend: no header AND no config → error
- [ ] T041 [P] [US1] Test routing decision object construction
- [ ] T042 [P] [US1] Test selection source logging (STATIC_CONFIG vs HEADER)
- [ ] T043 [P] [US1] Create tests/integration/dynamic-routing.test.ts
- [ ] T044 [US1] Send request with valid APIM-PROXIED-MCP-HOST header
- [ ] T045 [US1] Verify request forwarded to specified backend
- [ ] T046 [US1] Verify response returned to client correctly
- [ ] T047 [US1] Test with both HTTP and SSE backends
- [ ] T048 [US1] Test error response for invalid hostname (400)
- [ ] T049 [US1] Test backward compatibility: request without header uses static config
- [ ] T050 [US1] Test request correlation: response ID matches request ID through dynamic backend

**Checkpoint**: User Story 1 complete and independently testable - MVP feature delivered

---

## Phase 4: User Story 2 - Apply Filters to Dynamically-Routed Requests (Priority: P1)

**Goal**: Ensure filters are applied uniformly to dynamically-routed responses

**Independent Test**: Send request with both `APIM-PROXIED-MCP-HOST` header and filter configuration, verify filters are applied to response from dynamically-routed backend

**Success Criteria**: 
- SC-004: Filters applied to dynamically-routed responses match behavior of static-route responses

### Implementation for User Story 2

- [ ] T051 [P] [US2] Verify RequestForwarder in src/proxy/forwarder.ts accepts dynamic backend URLs
- [ ] T052 [US2] Ensure filter pipeline applies to dynamic routing responses (verify existing code works)
- [ ] T053 [US2] Test filter configuration resolution with dynamic routing
- [ ] T054 [US2] Verify filter chain execution order with dynamic backends

### Tests for User Story 2

- [ ] T055 [P] [US2] Test filter application with dynamic routing in tests/integration/dynamic-routing.test.ts
- [ ] T056 [US2] Test multiple filter chains with dynamic routing
- [ ] T057 [US2] Test filter references to static config with dynamic routing
- [ ] T058 [US2] Test filter error handling with dynamic backends

**Checkpoint**: User Story 2 complete - filters work uniformly regardless of routing source

---

## Phase 5: User Story 3 - Security: Validate Backend Hostname (Priority: P2)

**Goal**: Implement allowlist-based security to prevent routing to unauthorized backends

**Independent Test**: Configure allowlist of permitted backends, send request with disallowed hostname in header, verify proxy rejects with 403 Forbidden

**Success Criteria**: 
- SC-002: Allowlist validation prevents routing to non-whitelisted backends (403 responses)

### Implementation for User Story 3

- [ ] T059 [P] [US3] Create src/proxy/dynamic-routing/allowlist.ts - validates hostname against allowlist
- [ ] T060 [P] [US3] Implement exact hostname matching in allowlist.ts
- [ ] T061 [P] [US3] Implement wildcard pattern matching (*.internal.example.com) in allowlist.ts
- [ ] T062 [P] [US3] Implement IP address matching (if allowIpAddresses enabled) in allowlist.ts
- [ ] T063 [P] [US3] Implement CIDR range matching (192.168.1.0/24) in allowlist.ts
- [ ] T064 [US3] Implement deny-by-default logic (empty allowlist denies all)
- [ ] T065 [US3] Pre-compile allowlist patterns at config load for performance
- [ ] T066 [US3] Integrate allowlist validation into routing decision flow in selector.ts
- [ ] T067 [US3] Handle blocked backend errors (return 403 Forbidden)
- [ ] T068 [US3] Ensure no sensitive backend URLs exposed in client error responses

### Tests for User Story 3

- [ ] T069 [P] [US3] Create tests/unit/proxy/dynamic-routing/allowlist.test.ts
- [ ] T070 [P] [US3] Test exact hostname match: "server1.example.com" allowed
- [ ] T071 [P] [US3] Test exact hostname rejection: "server2.example.com" blocked
- [ ] T072 [P] [US3] Test wildcard pattern match: "*.internal.example.com" matches "mcp.internal.example.com"
- [ ] T073 [P] [US3] Test wildcard pattern rejection: "*.internal.example.com" blocks "external.com"
- [ ] T074 [P] [US3] Test IP address matching: "192.168.1.100" matches
- [ ] T075 [P] [US3] Test CIDR range matching: "192.168.1.0/24"
- [ ] T076 [P] [US3] Test empty allowlist: denies all dynamic routing
- [ ] T077 [P] [US3] Test deny-by-default: allowlist not configured → deny
- [ ] T078 [P] [US3] Create tests/security/dynamic-routing.test.ts
- [ ] T079 [P] [US3] Test allowlist enforcement: blocked backend returns 403
- [ ] T080 [P] [US3] Test deny-by-default: unallowlisted backend returns 403
- [ ] T081 [P] [US3] Test header injection: special characters in hostname rejected
- [ ] T082 [P] [US3] Test URL-encoded injection attacks
- [ ] T083 [US3] Test header spoofing: cannot override with additional headers
- [ ] T084 [US3] Test routing doesn't expose internal backend URLs to client errors
- [ ] T085 [US3] Test error response for blocked hostname (403) in tests/integration/dynamic-routing.test.ts
- [ ] T086 [P] [US3] Test edge case: allowlist blocks header-specified backend even when config has same hostname (header should be denied if not in allowlist)

**Checkpoint**: User Story 3 complete - all backends validated against allowlist before routing

---

## Phase 6: Logging & Observability

**Purpose**: Log routing decisions for debugging and auditing (supports SC-006)

- [ ] T087 [P] Add routing decision logging in src/proxy/middleware/logger.ts
- [ ] T088 [P] Log backend selection source (STATIC_CONFIG vs HEADER) in request context
- [ ] T089 Log validation errors (invalid hostname, blocked backend) with appropriate detail
- [ ] T090 Add metrics for dynamic routing (count by selection source, errors)
- [ ] T091 Verify no sensitive backend URLs exposed in client error responses
- [ ] T092 [P] Test logging captures 100% of routing decisions with correct source labels (STATIC_CONFIG, HEADER, ERROR) in tests/unit/proxy/middleware/logger.test.ts

**Checkpoint**: Logging complete - 100% of routing decisions are logged and tested

---

## Phase 7: Configuration Schema Validation Tests

**Purpose**: Validate configuration parsing and schema compliance

- [ ] T093 [P] Extend tests/unit/config/schema.test.ts with dynamicBackendRouting tests
- [ ] T094 [P] Test valid dynamicBackendRouting config
- [ ] T095 [P] Test invalid allowlist entries (rejected)
- [ ] T096 [P] Test missing allowlist (defaults to empty/deny)
- [ ] T097 [P] Test header name validation
- [ ] T098 [P] Test denyByDefault flag
- [ ] T099 [P] Test defaultPort validation
- [ ] T100 [P] Test allowIpAddresses flag
- [ ] T101 [P] Test allowInsecureProtocol flag (MVP: always false)

**Checkpoint**: Config validation fully tested

---

## Phase 8: Polish & Documentation

**Purpose**: Documentation, examples, and final integration

- [ ] T102 [P] Create docs/dynamic-routing.md with feature overview (include architecture diagram showing header extraction → allowlist → routing decision flow; configuration examples; troubleshooting guide)
- [ ] T103 Create example request/response in examples/ (provide curl commands for: valid header, blocked hostname, fallback to config, filter application)
- [ ] T104 Update README.md with dynamic routing section (quick start, configuration reference, link to docs/dynamic-routing.md)
- [ ] T105 Update API documentation with routing flow diagram (Mermaid or ASCII diagram showing request processing pipeline with dynamic routing injection point)
- [ ] T106 Run full test suite and verify zero regression
- [ ] T107 Verify backward compatibility: HTTP-only configs work unchanged

**Checkpoint**: All documentation and examples complete

---

## Phase 9: Performance & Validation

**Purpose**: Performance testing and final acceptance validation (SC-005, SC-007)

- [ ] T108 Performance test: measure header parsing + allowlist check latency in tests/performance/
- [ ] T109 Verify <2ms per-request overhead (SC-005)
- [ ] T110 Memory usage test: no leaks with 1000 dynamic routing requests
- [ ] T111 Concurrent dynamic routing test: verify thread-safety
- [ ] T112 Measure throughput impact: verify no regression from 1000 req/s baseline
- [ ] T113 Verify SC-001: routing to specified backend works
- [ ] T114 Verify SC-002: allowlist prevents unauthorized backends
- [ ] T115 Verify SC-003: static routes have zero overhead
- [ ] T116 Verify SC-004: filters applied uniformly
- [ ] T117 Verify SC-005: <2ms overhead
- [ ] T118 Verify SC-006: logging complete for 100% of requests (validated earlier in T092)
- [ ] T119 Verify SC-007: zero regression (all 105 existing tests pass)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
        ↓
Phase 2 (Foundational) ← BLOCKS all user stories
        ↓
    ┌───────────────┬───────────────┬───────────────┐
    ↓               ↓               ↓               ↓
Phase 3 (US1)   Phase 4 (US2)   Phase 5 (US3)   Phase 6 (Logging)
    ↓               ↓               ↓               ↓
    └───────────────┴───────────────┴───────────────┘
                    ↓
            Phase 7 (Config Tests)
                    ↓
            Phase 8 (Polish)
                    ↓
            Phase 9 (Performance)
```

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Adds security to US1 routing

**Independence**: Each user story delivers value independently and can be tested without the others

### Parallel Opportunities

**Within Phases**:
- Phase 1: T002, T003, T005, T006, T007 can run in parallel
- Phase 2: T009, T010, T012 can run in parallel
- Phase 3 (US1): T013-T022 models/services can run in parallel; T029-T042 tests in parallel
- Phase 5 (US3): T059-T065 implementation in parallel; T069-T084 tests in parallel

**Between Phases**: 
- Once Phase 2 completes, Phases 3, 4, and 5 can develop in parallel (if team capacity allows)
- Phase 6 and 7 can run in parallel

---

## Parallel Execution Examples

### User Story 1 (After Foundational Phase)

```bash
# Launch all core modules together:
Task T013: "Create src/proxy/dynamic-routing/resolver.ts"
Task T014: "Implement parseBackendHostHeader() function"
Task T015: "Implement determinePort() function"
Task T016: "Implement determineProtocol() function"
Task T017: "Implement determineTransport() function"
Task T018: "Implement constructBackendUrl() function"
Task T019: "Create src/proxy/dynamic-routing/selector.ts"

# Launch all unit tests together:
Task T029-T036: "All resolver.test.ts tests"
Task T037-T042: "All selector.test.ts tests"
```

### User Story 3 (Security - After Foundational Phase)

```bash
# Launch all allowlist logic together:
Task T059: "Create allowlist.ts"
Task T060: "Implement exact hostname matching"
Task T061: "Implement wildcard pattern matching"
Task T062: "Implement IP address matching"
Task T063: "Implement CIDR range matching"

# Launch all security tests together:
Task T069-T077: "All allowlist.test.ts tests"
Task T078-T084: "All security tests"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Dynamic Routing)
4. Complete Phase 4: User Story 2 (Filters)
5. **STOP and VALIDATE**: Test US1+US2 independently
6. Deploy/demo if ready (basic dynamic routing with filters, NO security)

### Recommended: MVP + Security (All 3 User Stories)

1. Complete Phases 1-2 (Setup + Foundational)
2. Complete Phase 3: User Story 1 (Dynamic Routing)
3. Complete Phase 4: User Story 2 (Filters)
4. Complete Phase 5: User Story 3 (Security - CRITICAL for production)
5. Complete Phases 6-9 (Logging, Tests, Polish, Performance)
6. **Production-ready**: All features with security validation

### Parallel Team Strategy

With multiple developers (after Phase 2 completes):

- **Developer A**: User Story 1 (T013-T050)
- **Developer B**: User Story 3 (T059-T085) 
- **Developer C**: User Story 2 (T051-T058) + Logging (T086-T090)

Stories complete and integrate independently, then merge for final validation.

---

## Task Summary

- **Total Tasks**: 119
- **Setup Tasks**: 7 (T001-T007)
- **Foundational Tasks**: 5 (T008-T012)
- **User Story 1 Tasks**: 38 (T013-T050) - Dynamic routing implementation + tests
- **User Story 2 Tasks**: 8 (T051-T058) - Filter integration + tests
- **User Story 3 Tasks**: 28 (T059-T086) - Security implementation + tests
- **Logging Tasks**: 6 (T087-T092)
- **Config Tests**: 9 (T093-T101)
- **Polish Tasks**: 6 (T102-T107)
- **Performance Tasks**: 12 (T108-T119)

**Parallel Opportunities**: 52 tasks can run in parallel (marked with [P])

**MVP Task Count**: Phase 1-4 = ~68 tasks (basic feature without security)
**Production-Ready**: All 119 tasks (includes security, logging, performance)

---

## Notes

- **[P] tasks**: Different files, no dependencies - safe to parallelize
- **[Story] labels**: Map tasks to user stories for traceability
- **MVP scope**: User Stories 1+2 deliver basic dynamic routing with filters
- **Production scope**: Add User Story 3 for security (deny-by-default allowlist)
- **Tests**: All tests included as spec requires coverage for all 11 FRs
- **Independence**: Each user story is independently testable
- **Reference**: See protocol-handling-design.md for Rules 1-5 implementation details
- **Commit strategy**: Commit after each checkpoint or logical task group
- **Validation**: Stop at any checkpoint to validate story independently
