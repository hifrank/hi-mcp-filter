# Feature 003: Dynamic Backend Routing via Request Header

**Branch**: `003-dynamic-backend-routing`  
**Created**: 2026-01-29  
**Status**: Phase 1 Complete (Design & Documentation)

## Documentation Structure

This feature is fully documented with 4 complementary documents, each serving a different audience:

### For Implementation Teams 👨‍💻

1. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** ← **START HERE**
   - 5 Rules at a glance with examples
   - Error handling cheat sheet
   - Configuration example
   - Testing checklist
   - Implementation task tracking
   - Debug troubleshooting guide
   - 📖 **Use this for daily development**

2. **[protocol-handling-design.md](./protocol-handling-design.md)** ← Deep Dive
   - Complete technical specification (Rules 1-5 with algorithms)
   - Configuration schema with all fields
   - Validation rules and error responses
   - Performance targets and optimization strategies
   - Testing strategy with code examples
   - Future enhancement roadmap
   - 📖 **Reference this when implementing tasks T008-T016**

### For Project Managers & Product Owners 📊

3. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)**
   - What was created (3 documents)
   - Design principles (secure-by-default, backward compatible, etc.)
   - How implementation teams use this
   - Documentation hierarchy
   - Key decisions & rationale
   - What's ready vs. what's next
   - Success metrics
   - 📖 **Use this to track progress and understand design decisions**

### For Business Stakeholders & QA 🎯

4. **[spec.md](./spec.md)** (Feature Specification)
   - User scenarios and testing (3 user stories)
   - Functional requirements (11 FRs)
   - Success criteria (7 measurable outcomes)
   - Technical considerations (protocol rules, examples, config)
   - Constitution check (7 principles verified)
   - 📖 **Use this for acceptance criteria and QA testing**

### Implementation Roadmap

5. **[plan.md](./plan.md)** (Implementation Plan)
   - 12 implementation phases
   - 93 detailed tasks with dependencies
   - Parallel opportunities
   - Task groupings and checkpoints
   - Success validation checklist
   - 📖 **Use this to track implementation progress**

---

## Quick Navigation

**I want to...**

- 🚀 **Start implementing** → Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- 📋 **Understand the design deeply** → Read [protocol-handling-design.md](./protocol-handling-design.md)
- 📊 **Track project progress** → Read [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- ✅ **Write acceptance tests** → Read [spec.md](./spec.md) + [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- 🗓️ **Plan sprints** → Read [plan.md](./plan.md)
- 🔧 **Debug an issue** → Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) § Debug Checklist, then [protocol-handling-design.md](./protocol-handling-design.md) § Error Handling

---

## Feature Overview

**Goal**: Enable Azure API Management (APIM) to dynamically specify MCP backend targets via the `APIM-PROXIED-MCP-HOST` request header, allowing APIM to delegate requests to the proxy for advanced filtering.

**Key Features**:
- ✅ Header-based dynamic backend routing
- ✅ Allowlist-based security (deny-by-default)
- ✅ Automatic port and protocol selection
- ✅ Transport-agnostic (HTTP & SSE support)
- ✅ Filter pipeline integration
- ✅ Comprehensive logging
- ✅ Backward compatible (static routes unchanged)

**Success Criteria**:
- Routes requests with valid header to specified backend (SC-001)
- Allowlist validates backend hostnames (SC-002)
- Static routes have zero latency overhead (SC-003)
- Filters apply uniformly (SC-004)
- Header validation <2ms per request (SC-005)
- 100% of routing decisions logged (SC-006)
- Zero regression in existing tests (SC-007)

---

## Protocol Handling (5 Rules)

| Rule | What | Input → Output |
|---|---|---|
| **1** | Extract hostname & port | Header → {hostname, port?} |
| **2** | Determine port number | {port?, defaultPort?} → port (1-65535) |
| **3** | Determine protocol | → "https" (MVP: always HTTPS) |
| **4** | Determine transport | {hostname, config, response} → "http" \| "sse" |
| **5** | Construct URL | {protocol, hostname, port, transport} → full URL |

**Example**: `APIM-PROXIED-MCP-HOST: server.example.com:9000` with config `defaultPort: 443`
```
Rule 1: {hostname: "server.example.com", port: 9000}
Rule 2: port = 9000 (explicit wins)
Rule 3: protocol = "https" (always)
Rule 4: transport = "http" (default, or detected from response)
Rule 5: URL = "https://server.example.com:9000/mcp"
```

**For all examples and details**: See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) or [protocol-handling-design.md](./protocol-handling-design.md)

---

## Implementation Status

### ✅ Phase 1: Design & Documentation (COMPLETE)
- ✅ Feature specification with 3 user stories, 11 FRs, 7 success criteria
- ✅ Technical design with 5 rules, algorithms, examples, validation rules
- ✅ Configuration schema with all fields defined
- ✅ Error handling with status codes and response format
- ✅ Performance targets and optimization strategies
- ✅ Testing strategy with code examples
- ✅ Implementation roadmap with 93 tasks
- ✅ Quick reference guide for developers

### ⏳ Phase 2-12: Implementation (PENDING)
- Foundation (config types, schema)
- Core routing logic (Rules 1-5)
- Integration with request handler
- Logging & observability
- Unit tests (header parsing, allowlist, selection)
- Integration tests (end-to-end)
- Security tests (allowlist enforcement)
- Performance validation
- Polish & documentation

**Start Date**: [To be scheduled]  
**Estimated Duration**: 5 days (12 phases)  
**Team**: [To be assigned]

---

## Key Design Decisions

| Decision | Why | Flexibility |
|---|---|---|
| **HTTPS always (MVP)** | Secure-by-default; no MITM risk | Phase 2: Allow opt-in HTTP for internal backends |
| **Port precedence** | explicit > config > 443 | Clear rules, no ambiguity |
| **Transport: config > detect > default** | Known backends configured; auto-detect for unknown | Per-backend override possible |
| **Deny-by-default allowlist** | Prevent open redirector attacks | Config flag to relax (not recommended) |
| **Filters apply uniformly** | Consistent behavior regardless of routing source | Same filter pipeline for all backends |

---

## Configuration Example

```json
{
  "dynamicBackendRouting": {
    "enabled": true,
    "headerName": "APIM-PROXIED-MCP-HOST",
    "allowlist": [
      "*.internal.example.com",
      "mcp-server-1.example.com",
      "mcp-server-2.example.com",
      "192.168.1.100"
    ],
    "denyByDefault": true,
    "defaultPort": 443,
    "allowIpAddresses": false,
    "allowInsecureProtocol": false
  }
}
```

**For detailed schema**: See [protocol-handling-design.md](./protocol-handling-design.md) § Configuration Schema

---

## Next Steps

### For Developers
1. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) § 5 Rules at a Glance
2. Review [protocol-handling-design.md](./protocol-handling-design.md) § Rule Set
3. Follow [plan.md](./plan.md) Phase 1-2 tasks
4. Reference [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) § Testing Checklist

### For Project Managers
1. Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
2. Schedule Phase 2-12 implementation (estimated 5 days)
3. Assign implementation team
4. Track progress against [plan.md](./plan.md)

### For Product Managers
1. Review [spec.md](./spec.md) § User Scenarios & Success Criteria
2. Define acceptance testing strategy
3. Plan stakeholder communication
4. Prepare go/no-go criteria

---

## File Reference

```
specs/003-dynamic-backend-routing/
├── README.md                              ← You are here
├── QUICK_REFERENCE.md                     ← Start here for implementation
├── IMPLEMENTATION_SUMMARY.md              ← Track progress
├── protocol-handling-design.md            ← Complete technical spec
├── spec.md                                ← Business requirements
├── plan.md                                ← Implementation roadmap
└── checklists/
    └── requirements.md                    ← Spec quality checklist
```

---

## Questions?

- **About implementation**: See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) § Debug Checklist
- **About design decisions**: See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) § Key Decisions & Rationale
- **About specific rules**: See [protocol-handling-design.md](./protocol-handling-design.md) § Rule Set
- **About acceptance criteria**: See [spec.md](./spec.md) § User Scenarios & Success Criteria
- **About task tracking**: See [plan.md](./plan.md)

---

**Last Updated**: 2026-01-29  
**Documentation Status**: Phase 1 Complete  
**Ready for Implementation**: ✅ Yes
