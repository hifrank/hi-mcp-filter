# Summary: Protocol Handling Design for Dynamic Backend Routing

**Date**: 2026-01-29  
**Feature**: Dynamic Backend Routing via Request Header (003)  
**Status**: Phase 1 Complete (Design & Documentation)

## What Was Created

### 1. **protocol-handling-design.md** (NEW - Complete Technical Design)

A comprehensive technical design document that specifies **exactly how the proxy will determine backend connectivity details** when processing dynamic routing requests.

**Contents**:
- **Rule 1-5 Specifications** (Algorithm, examples, rationale):
  1. Extract hostname & port from `APIM-PROXIED-MCP-HOST` header
  2. Determine port number (explicit > config > 443 default)
  3. Determine protocol (HTTPS always in MVP)
  4. Determine transport type (HTTP vs SSE)
  5. Construct backend URL with correct path prefix

- **Configuration Schema** with all field definitions
- **Validation Rules** (hostnames, ports, allowlist matching, CIDR ranges)
- **Error Handling** with status codes and response format
- **Performance Targets** (<2ms overhead) with optimization strategies
- **Testing Strategy** with code examples for unit/integration/security tests
- **Future Enhancement Path** (explicit protocol, custom paths, TLS, mTLS, hostname rewriting)

**Key Value**: Implementation teams reference this document to ensure protocol rules are correctly implemented. Each task (T008-T016) should validate implementation against these specifications.

---

### 2. **spec.md** (UPDATED - Complete Protocol Rules)

The feature specification was enhanced with:
- **Technical Considerations** section with:
  - Step-by-step protocol & port selection algorithm
  - Examples table showing header → URL transformation
  - Configuration schema
- **Success Criteria** refined to include protocol/port requirements
- Removed duplicate template text (cleaned up)

**Key Value**: Business stakeholders and QA teams understand the exact protocol behavior expected in production.

---

### 3. **plan.md** (UPDATED - Design Reference)

The implementation plan was updated with:
- **Design Documents** section that references `protocol-handling-design.md`
- Instructions to **reference protocol design when implementing Tasks T008-T016**
- Clear pointer that protocol rules are comprehensive and ready to implement

**Key Value**: Implementation teams know where to find the technical rules and can implement with confidence.

---

## Design Principles

The protocol handling design follows these key principles:

### ✅ Secure-by-Default
- HTTPS always (no insecure protocol in MVP)
- Deny-by-default allowlist (only whitelisted backends allowed)
- No sensitive data in error responses

### ✅ Backward Compatible
- Static routing unchanged (requests without header use config)
- Zero latency overhead for existing deployments
- Optional feature (must be explicitly enabled in config)

### ✅ Flexible
- Port can be explicit in header, config default, or hardcoded (443)
- Transport auto-detected from response or statically configured
- Clear path for future enhancements (explicit protocol, custom paths)

### ✅ High Performance
- Target <2ms overhead per request for validation + URL construction
- Pre-compilation of allowlist patterns during config load
- Lazy transport detection (only on first request to backend)

### ✅ Well-Tested
- Unit tests for each validation rule (header parsing, port determination, etc.)
- Integration tests for end-to-end flows
- Security tests for allowlist enforcement and injection attacks
- Performance benchmarks to verify <2ms target

---

## How Implementation Teams Use This

**Phase 1 Tasks (T001-T007)**: Foundation
- Create config types and schema
- **Reference**: protocol-handling-design.md → Configuration Schema section

**Phase 2 Tasks (T008-T016)**: Core Routing Logic
- Implement header parsing (Rule 1)
- Implement port determination (Rule 2)
- Implement protocol selection (Rule 3)
- Implement transport detection (Rule 4)
- Implement URL construction (Rule 5)
- **Reference**: protocol-handling-design.md → Rule Set section with algorithms, examples, and validation rules

**Phase 5-7 Tasks (T028-T050)**: Unit Testing
- Test each rule independently
- **Reference**: protocol-handling-design.md → Testing Strategy section with code examples

**Phase 8 Tasks (T051-T060)**: Integration Testing
- Test end-to-end flows
- **Reference**: protocol-handling-design.md → Examples section with header → URL transformations

---

## Documentation Hierarchy

```
spec.md (Business Requirements)
  ↓
  ├─ Technical Considerations (overview)
  └─ Success Criteria (validation targets)

protocol-handling-design.md (Technical Rules)
  ↓
  ├─ Rule Set (algorithms with examples)
  ├─ Validation Rules (error cases)
  ├─ Testing Strategy (code examples)
  └─ Future Enhancements (extension path)

plan.md (Implementation Roadmap)
  ↓
  └─ References → protocol-handling-design.md for Tasks T008-T016
```

---

## Key Decisions & Rationale

| Decision | Rationale | Future Flexibility |
|---|---|---|
| Protocol always HTTPS in MVP | Secure-by-default; no man-in-the-middle risk | Phase 2: Allow opt-in HTTP for internal backends |
| Port precedence: explicit > config > 443 | User intent (explicit) > operator policy > security default | Clear precedence avoids ambiguity |
| Transport: config > auto-detect > HTTP default | Static config for known backends, auto-detect for unknown, safe default | Per-backend config can override |
| Deny-by-default allowlist | Security: prevent open redirector attacks | Config option to relax validation (not recommended) |
| Error responses don't expose backend URLs | Security: prevents information leakage | Future: Admin-only detailed error logs |

---

## What's Ready for Implementation

✅ Complete protocol handling specification (Rules 1-5)
✅ Configuration schema with all fields  
✅ Validation rules with error codes and response format
✅ Performance targets and optimization strategies
✅ Testing strategy with code examples
✅ Future enhancement roadmap

## What's Next

**Phase 1 (Days 1-2)**: Implement foundation (config types, schema, validation)  
→ **Reference**: protocol-handling-design.md § Configuration Schema

**Phase 2 (Days 2-3)**: Implement core routing logic (header parsing, URL construction)  
→ **Reference**: protocol-handling-design.md § Rule Set

**Phase 5-8 (Days 3-4)**: Implement and test all functionality  
→ **Reference**: protocol-handling-design.md § Testing Strategy

---

## Files Created/Modified

| File | Status | Content |
|---|---|---|
| protocol-handling-design.md | **NEW** | Complete technical specification for protocol handling (Rules 1-5) |
| spec.md | UPDATED | Added Technical Considerations section with protocol rules and config schema |
| plan.md | UPDATED | Added Design Documents section referencing protocol-handling-design.md |

---

## Success Metrics

The implementation is successful when:
- ✅ All protocol rules (1-5) correctly implemented and tested
- ✅ Performance target met: <2ms overhead for header validation + URL construction
- ✅ Security target met: 100% of dynamically-routed requests validated against allowlist
- ✅ Backward compatibility maintained: 0% regression in existing tests
- ✅ All 3 documents kept in sync during implementation

---

Generated: 2026-01-29
