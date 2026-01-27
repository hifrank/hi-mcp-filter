# Tasks: MCP SSE Transport Support

**Input**: Design documents from `/specs/002-mcp-sse-transport/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency setup

- [ ] T001 Install eventsource-parser dependency: `npm install eventsource-parser`
- [ ] T002 [P] Create SSE types file in src/types/sse.ts
- [ ] T003 [P] Update gitignore if needed for SSE-specific artifacts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core SSE infrastructure that MUST be complete before user story work

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [ ] T004 Extend MCPServerConfig type in src/types/config.ts with transport field
- [ ] T005 Extend MCPServerConfig type in src/types/config.ts with sseOptions field
- [ ] T006 Update config schema in src/config/schema.ts to validate transport field
- [ ] T007 Update config schema in src/config/schema.ts to validate sseOptions
- [ ] T008 [P] Update config validator in src/config/validator.ts with transport enum validation
- [ ] T009 [P] Update config validator in src/config/validator.ts with sseBufferSize range validation

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Proxy SSE-based MCP Servers (Priority: P1) 🎯 MVP

**Goal**: Enable proxy to forward requests to SSE-based MCP servers (Azure APIM) and extract JSON-RPC responses

**Independent Test**: Configure proxy with Azure APIM endpoint, send initialize request, verify JSON-RPC response extracted from SSE stream

### Implementation for User Story 1

- [ ] T010 [P] [US1] Create SSEEvent interface in src/types/sse.ts
- [ ] T011 [P] [US1] Create SSEConnection interface in src/types/sse.ts
- [ ] T012 [US1] Implement SSEParser class in src/proxy/sse-parser.ts using eventsource-parser
- [ ] T013 [US1] Add parseSSEStream method to SSEParser in src/proxy/sse-parser.ts
- [ ] T014 [US1] Add extractJSONRPC method to SSEParser in src/proxy/sse-parser.ts
- [ ] T015 [US1] Add event buffering logic to SSEParser in src/proxy/sse-parser.ts
- [ ] T016 [US1] Add multi-line data field handling to SSEParser in src/proxy/sse-parser.ts
- [ ] T017 [US1] Extend RequestForwarder in src/proxy/forwarder.ts with SSE transport detection
- [ ] T018 [US1] Add forwardSSE method to RequestForwarder in src/proxy/forwarder.ts
- [ ] T019 [US1] Integrate SSEParser into forwardSSE method in src/proxy/forwarder.ts
- [ ] T020 [US1] Add SSE parsing error handling in src/proxy/forwarder.ts (return 502 on parse error)
- [ ] T021 [US1] Add logging for SSE connection lifecycle in src/proxy/forwarder.ts
- [ ] T022 [US1] Update proxy route handler in src/proxy/routes/proxy.ts to use forwardSSE when transport is SSE

### Tests for User Story 1

- [ ] T023 [P] [US1] Unit test SSEParser with valid SSE stream in tests/unit/sse-parser.test.ts
- [ ] T024 [P] [US1] Unit test SSEParser with invalid JSON in data field in tests/unit/sse-parser.test.ts
- [ ] T025 [P] [US1] Unit test SSEParser with multi-line data fields in tests/unit/sse-parser.test.ts
- [ ] T026 [P] [US1] Unit test SSEParser event filtering (message vs close) in tests/unit/sse-parser.test.ts
- [ ] T027 [P] [US1] Contract test for SSE format compliance in tests/contract/sse-format.test.ts
- [ ] T028 [US1] Integration test proxy with Azure APIM SSE endpoint in tests/integration/azure-apim.test.ts
- [ ] T029 [US1] Integration test SSE parsing error handling (502 response) in tests/integration/sse-proxy.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional - proxy can handle SSE-based MCP servers

---

## Phase 4: User Story 2 - Support Both HTTP and SSE Transports (Priority: P1)

**Goal**: Enable proxy to support both HTTP and SSE transports in same deployment with auto-detection

**Independent Test**: Configure two servers (one HTTP, one SSE), send requests to each, verify both work correctly

### Implementation for User Story 2

- [ ] T030 [P] [US2] Create transport detection module in src/proxy/transport.ts
- [ ] T031 [US2] Implement detectTransport function in src/proxy/transport.ts (checks Content-Type header)
- [ ] T032 [US2] Implement getTransportForServer function in src/proxy/transport.ts (reads config transport field)
- [ ] T033 [US2] Update RequestForwarder in src/proxy/forwarder.ts to call transport detection
- [ ] T034 [US2] Add transport routing logic in src/proxy/forwarder.ts (if SSE → forwardSSE, else → forwardHTTP)
- [ ] T035 [US2] Add X-Proxy-Transport header to responses in src/proxy/forwarder.ts
- [ ] T036 [US2] Update proxy route handler in src/proxy/routes/proxy.ts to support auto-detection
- [ ] T037 [US2] Update config/azure-mcp.json to set transport: "sse"
- [ ] T038 [US2] Update config/default.json with SSE configuration example

### Tests for User Story 2

- [ ] T039 [P] [US2] Unit test detectTransport with text/event-stream header in tests/unit/transport.test.ts
- [ ] T040 [P] [US2] Unit test detectTransport with application/json header in tests/unit/transport.test.ts
- [ ] T041 [P] [US2] Unit test getTransportForServer with explicit transport config in tests/unit/transport.test.ts
- [ ] T042 [P] [US2] Unit test getTransportForServer with auto transport config in tests/unit/transport.test.ts
- [ ] T043 [US2] Integration test mixed HTTP and SSE servers in same proxy in tests/integration/sse-proxy.test.ts
- [ ] T044 [US2] Integration test auto-detection with SSE server in tests/integration/sse-proxy.test.ts
- [ ] T045 [US2] Integration test auto-detection with HTTP server in tests/integration/sse-proxy.test.ts

**Checkpoint**: Both User Stories 1 AND 2 are functional - proxy supports both transport types

---

## Phase 5: User Story 3 - Handle SSE Streaming and Timeouts (Priority: P2)

**Goal**: Implement timeout handling for SSE connections and graceful resource cleanup

**Independent Test**: Send request to slow SSE server, verify proxy times out after configured duration

### Implementation for User Story 3

- [ ] T046 [P] [US3] Add timeout enforcement using AbortController in src/proxy/sse-parser.ts
- [ ] T047 [US3] Add timeout error handling in src/proxy/forwarder.ts (return 504 on timeout)
- [ ] T048 [US3] Add SSE connection cleanup on timeout in src/proxy/sse-parser.ts
- [ ] T049 [US3] Add graceful shutdown handling for active SSE connections in src/index.ts
- [ ] T050 [US3] Add SIGTERM handler to close SSE connections in src/index.ts
- [ ] T051 [US3] Add timeout accuracy logging in src/proxy/forwarder.ts

### Tests for User Story 3

- [ ] T052 [P] [US3] Unit test SSE timeout with AbortController in tests/unit/sse-parser.test.ts
- [ ] T053 [P] [US3] Unit test timeout error response (504) in tests/unit/sse-parser.test.ts
- [ ] T054 [US3] Integration test SSE timeout handling in tests/integration/sse-proxy.test.ts
- [ ] T055 [US3] Integration test graceful shutdown with active SSE connections in tests/integration/sse-proxy.test.ts
- [ ] T056 [US3] Performance test timeout accuracy (±5% of configured value) in tests/integration/sse-proxy.test.ts

**Checkpoint**: All P1 and P2 user stories are functional - production-ready for SSE support

---

## Phase 6: User Story 4 - Preserve SSE Format for Streaming Clients (Priority: P3)

**Goal**: Support pass-through SSE streaming mode for clients that want native SSE events

**Independent Test**: Configure endpoint with streaming mode, verify client receives SSE events in real-time

### Implementation for User Story 4

- [ ] T057 [P] [US4] Add sseStreamingMode field to SSETransportConfig in src/types/sse.ts
- [ ] T058 [US4] Implement streaming response handler in src/proxy/forwarder.ts
- [ ] T059 [US4] Add stream piping logic from backend SSE to client in src/proxy/forwarder.ts
- [ ] T060 [US4] Update proxy route to detect Accept: text/event-stream header in src/proxy/routes/proxy.ts
- [ ] T061 [US4] Add streaming mode configuration validation in src/config/validator.ts

### Tests for User Story 4

- [ ] T062 [P] [US4] Unit test streaming mode configuration parsing in tests/unit/config/validator.test.ts
- [ ] T063 [US4] Integration test SSE pass-through streaming in tests/integration/sse-proxy.test.ts
- [ ] T064 [US4] Integration test streaming mode with filters applied in tests/integration/sse-proxy.test.ts

**Checkpoint**: All user stories (P1, P2, P3) are complete and independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, metrics, and final integration

- [ ] T065 [P] Add Prometheus metrics for SSE parsing in src/proxy/sse-parser.ts (sse_events_parsed_total)
- [ ] T066 [P] Add Prometheus metrics for SSE errors in src/proxy/sse-parser.ts (sse_parse_errors_total)
- [ ] T067 [P] Add Prometheus metrics for SSE timeouts in src/proxy/forwarder.ts (sse_timeouts_total)
- [ ] T068 [P] Create SSE transport documentation in docs/sse-transport.md
- [ ] T069 Update main README.md with SSE support section
- [ ] T070 [P] Add SSE examples to examples/ directory
- [ ] T071 Update API documentation with transport configuration
- [ ] T072 Run full test suite and verify all 47 existing tests still pass
- [ ] T073 Verify backward compatibility: HTTP-only configs work without changes
- [ ] T074 Performance test: verify SSE adds <10ms to p95 latency
- [ ] T075 Memory leak test: 1000 sequential SSE requests with stable memory usage

---

## Dependencies

### User Story Completion Order

```
Phase 1 (Setup) → Phase 2 (Foundation)
                       ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
  US1 (P1)          US2 (P1)          US3 (P2)
    │                 │                 │
    └─────────────────┴─────────────────┘
                       ↓
                    US4 (P3)
                       ↓
                Polish & Cross-Cutting
```

**Blocking Dependencies**:
- Phase 2 MUST complete before any user story work
- US2 depends on US1 (transport detection requires SSE parser)
- US3 can develop in parallel with US2 after US1 completes
- US4 depends on US1 and US2

**Parallel Opportunities**:
- Within Phase 2: T008 and T009 (different validation rules)
- Within US1: T010 and T011 (different interfaces), T023-T027 (different test files)
- Within US2: T039-T042 (different test cases)
- After US1: US3 can start while US2 is in progress
- Phase 7: All tasks except T072-T075 (T065-T071 are independent)

---

## Parallel Execution Examples

### Phase 2 Foundation
```bash
# Run config schema updates in parallel
T006 (schema.ts transport) || T007 (schema.ts sseOptions) || T008 (validator transport) || T009 (validator buffer)
```

### User Story 1 Tests
```bash
# Run all unit tests in parallel
T023 (valid SSE) || T024 (invalid JSON) || T025 (multi-line) || T026 (event filter) || T027 (contract)
```

### User Story 2 Tests
```bash
# Run transport detection tests in parallel
T039 (SSE header) || T040 (JSON header) || T041 (explicit config) || T042 (auto config)
```

### Phase 7 Polish
```bash
# Run documentation and metrics in parallel
T065 (metrics parsed) || T066 (metrics errors) || T067 (metrics timeout) || T068 (docs) || T069 (README)
```

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
- **Phase 1**: Setup ✅
- **Phase 2**: Foundation ✅
- **Phase 3**: User Story 1 (SSE proxy basic) ✅
- **Phase 4**: User Story 2 (transport detection) ✅
- **Outcome**: Proxy can handle Azure APIM SSE endpoints with auto-detection

### Phase 2 Delivery (Production Ready)
- **Phase 5**: User Story 3 (timeouts and cleanup) ✅
- **Phase 7**: Polish (metrics, docs, performance validation) ✅
- **Outcome**: Production-ready with monitoring and documentation

### Phase 3 Delivery (Advanced Features)
- **Phase 6**: User Story 4 (streaming mode) ✅
- **Outcome**: Full feature set including pass-through streaming

---

## Task Summary

- **Total Tasks**: 75
- **Setup Tasks**: 3 (T001-T003)
- **Foundation Tasks**: 6 (T004-T009)
- **User Story 1 Tasks**: 20 (T010-T029) - Implementation: 13, Tests: 7
- **User Story 2 Tasks**: 16 (T030-T045) - Implementation: 9, Tests: 7
- **User Story 3 Tasks**: 11 (T046-T056) - Implementation: 6, Tests: 5
- **User Story 4 Tasks**: 8 (T057-T064) - Implementation: 5, Tests: 3
- **Polish Tasks**: 11 (T065-T075)

**Parallel Opportunities**: 35 tasks can run in parallel (marked with [P])

**MVP Task Count**: 29 tasks (Phase 1 + Phase 2 + US1 + US2)

---

## Success Validation Checklist

After completing all tasks, verify:

- [ ] Azure APIM integration test passes (SC-001)
- [ ] Both HTTP and SSE transports work in same deployment (SC-002)
- [ ] SSE connections timeout within ±5% of configured value (SC-003)
- [ ] No memory leaks in 1000 sequential SSE requests (SC-004)
- [ ] 100% of SSE parsing errors are logged with context (SC-005)
- [ ] Existing performance targets maintained (<100ms p95 for HTTP) (SC-006)
- [ ] All 47 existing tests pass (backward compatibility)
- [ ] SSE parsing adds <10ms to p95 latency
- [ ] Configuration changes are backward compatible
