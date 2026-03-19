---
name: tdd
description: Build features using Red-Green-Refactor vertical slices. Use this skill whenever you're implementing a feature, function, or module and want honest, behavior-driven tests that actually catch bugs instead of mocking internals. Works best for non-frontend backend features, algorithms, business logic, and data transformations. Triggers on phrases like "implement this feature," "write a function," "build this module," or any request for working, tested code.
---

# Test-Driven Development (TDD): Vertical Slices

This skill structures Claude's development workflow around **one test → one implementation → repeat** cycles, preventing common LLM pitfalls: imagined behavior, coupled tests, and over-engineering.

## The Core Problem

LLMs naturally work in **horizontal slices**: write all tests, then all code, then refactor. This leads to:
- Tests that verify mocks instead of real code paths
- Tests coupled to implementation details (they break on refactoring)
- Bad test patterns that become permanent liabilities
- Context running low mid-implementation, causing shortcuts

**Vertical slices** force honesty: each RED→GREEN→REFACTOR cycle tests one observable behavior, writes minimal implementation, then cleans up. Because you just wrote the code, you know exactly what matters.

## Planning Phase (Before Code)

Before writing any test or implementation, answer these questions:

### 1. What Interface Changes Are Needed?
- What new functions, methods, or APIs are you adding or modifying?
- What do they accept as input and what do they return?
- Example: "Add `calculateShipping(cart, region)` that returns a number"

### 2. Which Behaviors Matter Most?
- You can't test everything. What's the critical path?
- What's the most complex logic that could break?
- What's the most likely edge case to cause bugs?
- Example: "Most critical: calculating taxes correctly; edge case: free shipping threshold"

### 3. Can We Design for Deep Modules?
- A "deep module" has a small interface but complex logic inside
- Functions should accept dependencies rather than create them
- Functions should return results, not produce side effects
- Example: Avoid `getUserFromDB()` inside your logic; accept `user` as a parameter instead

### 4. Can We Design for Testability?
- No hard-coded dependencies (database connections, APIs, timestamps)
- Pure functions where possible (same input → same output)
- Dependency injection for collaborators
- Example: `calculatePrice(cart, taxRate)` not `calculatePrice(cart)` which queries a tax API

**Output**: A clear list of behaviors to implement in order (critical → edge cases), each phrased as an observable capability.

---

## The Workflow: RED → GREEN → REFACTOR

### RED: Write ONE Failing Test

Write **exactly one** test that:
- Tests **observable behavior** through the public interface
- Describes **WHAT** the system does, not **HOW** it's implemented
- Fails because the feature doesn't exist yet (or is incomplete)
- Reads like a specification: "user can checkout with valid cart"

**Example (good test):**
```typescript
test("calculateShipping returns correct cost for standard region", () => {
  const cart = { weight: 10, itemCount: 3 };
  const cost = calculateShipping(cart, "standard");
  expect(cost).toBe(15); // $1.50 per unit weight
});
```

**Example (bad test):**
```typescript
// ❌ Implementation detail: mocking internal collaborators
test("calculateShipping calls priceCache.get", () => {
  const mockCache = jest.mock(priceCache);
  calculateShipping(cart, "standard");
  expect(mockCache.get).toHaveBeenCalled();
});

// ❌ Bypasses interface: queries DB directly to verify
test("calculateShipping saves to database", () => {
  calculateShipping(cart, "standard");
  const saved = db.query("SELECT * FROM shipping WHERE...");
  expect(saved).toBeDefined();
});
```

### GREEN: Write Minimal Implementation

Write the **smallest amount of code** to make that test pass. No speculative features. Nothing beyond what's needed.

**Example:**
```typescript
function calculateShipping(cart, region) {
  if (region === "standard") {
    return cart.weight * 1.5;
  }
  return 0; // Placeholder for other regions
}
```

Run the test. It should pass. If it doesn't, debug the implementation (not the test).

### REFACTOR: Clean Up After All Tests Pass

Once **all tests in the current slice** pass:
- Remove duplication
- Simplify variable names
- Extract helper functions if logic repeats
- Keep tests intact; refactoring should not require test changes

**After refactoring, all tests still pass.** If a test breaks during refactor, you coupled it to implementation details—rewrite the test to verify behavior instead.

---

## Distinguishing Good Tests from Bad Tests

| Aspect | Good Test | Bad Test |
|--------|-----------|----------|
| **Focus** | Observable behavior through public interface | Implementation details or internal collaborators |
| **Reads like** | "System can do X" | "Function calls Y internally" |
| **Survives refactoring?** | Yes—behavior doesn't change | No—breaks when internals change |
| **Dependencies** | Accepts collaborators as parameters | Mocks them directly in test |
| **Verification** | Uses the interface | Queries DB, inspects call counts, bypasses API |

### RED FLAG: The Refactor Test

**The most common bad test pattern**: Your test breaks when you refactor, but the behavior hasn't changed.

- Renamed an internal function → test fails
- Moved logic to a helper → test fails
- Changed how you cache results internally → test fails

This means your test is verifying **implementation**, not **behavior**. Rewrite it to test what the user sees, not how you built it.

---

## Example: Building a Cart Checkout System

### Plan
1. **Interface**: `checkout(cart, paymentInfo) → {status, orderId}`
2. **Critical behaviors** (in order):
   - User can checkout with valid cart and payment
   - System rejects checkout with empty cart
   - System handles payment failures gracefully
3. **Design**: Functions accept `paymentProcessor` as parameter, not hardcoded

### Iteration 1 (RED)
```typescript
test("checkout with valid cart returns confirmed status", () => {
  const cart = { items: [{ id: 1, price: 25 }], total: 25 };
  const payment = { method: "card", amount: 25 };
  
  const result = checkout(cart, payment);
  
  expect(result.status).toBe("confirmed");
  expect(result.orderId).toBeDefined();
});
```
**Test fails** → Feature doesn't exist.

### Iteration 1 (GREEN)
```typescript
function checkout(cart, payment) {
  return {
    status: "confirmed",
    orderId: Math.random().toString()
  };
}
```
**Test passes.**

### Iteration 1 (REFACTOR)
No duplication yet. Move on.

### Iteration 2 (RED)
```typescript
test("checkout rejects empty cart", () => {
  const cart = { items: [], total: 0 };
  const payment = { method: "card", amount: 0 };
  
  const result = checkout(cart, payment);
  
  expect(result.status).toBe("rejected");
});
```
**Test fails** → Empty carts aren't handled.

### Iteration 2 (GREEN)
```typescript
function checkout(cart, payment) {
  if (!cart.items || cart.items.length === 0) {
    return { status: "rejected" };
  }
  
  return {
    status: "confirmed",
    orderId: Math.random().toString()
  };
}
```
**Tests pass** (both iteration 1 and 2).

### Iteration 2 (REFACTOR)
Extract the validation logic:
```typescript
function checkout(cart, payment) {
  if (isEmptyCart(cart)) {
    return { status: "rejected" };
  }
  
  return {
    status: "confirmed",
    orderId: generateOrderId()
  };
}

function isEmptyCart(cart) {
  return !cart.items || cart.items.length === 0;
}

function generateOrderId() {
  return Math.random().toString();
}
```
**All tests still pass** after refactoring.

---

## Why This Matters

### Problem: Horizontal Slicing (Bad)
```
Write 10 tests ➔ Write code to pass all 10 ➔ Hope tests are real
```
Result: Tests often verify mocks or imagined behavior. Context runs low mid-implementation.

### Solution: Vertical Slicing (Good)
```
Write test 1 ➔ Write minimal code ➔ Test 1 passes
Write test 2 ➔ Write minimal code ➔ Tests 1 & 2 pass
Write test 3 ➔ Write minimal code ➔ Tests 1, 2 & 3 pass
```
Result: Each cycle confirms real behavior. Tests are discovery, not checklist. No over-engineering.

---

## Checklist for Each Cycle

- [ ] **RED**: One test written, fails for the right reason (feature missing, not a typo)
- [ ] **GREEN**: Minimal code passes the test; no speculative features
- [ ] All previous tests still pass
- [ ] **REFACTOR**: Remove duplication, improve names, extract helpers
- [ ] All tests still pass after refactoring
- [ ] Test reads like a specification, not an implementation detail

---

## When to Use This Skill

✅ **Use vertical-slice TDD for:**
- Features with complex business logic (checkout, pricing, permissions)
- Algorithms and transformations
- Database query builders or ORMs
- API endpoints with multiple behaviors
- Utilities and helper functions
- Any backend logic where honesty matters

❌ **Skip this workflow for:**
- UI/visual components (use design-focused skills instead)
- One-off scripts or throwaway code
- Exploratory code where you're unsure of the direction

---

## Notes on Test Frameworks

This workflow works with any test framework (Jest, Vitest, pytest, unittest, etc.). The pattern is language-agnostic.

Key requirement: **Tests must actually run and fail/pass**. If you're writing "fake" tests that don't execute, this whole approach breaks down.
