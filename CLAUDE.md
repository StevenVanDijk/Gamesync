# Development Guidelines

## Change Process

Every change to this codebase must follow these rules:

1. **Add user stories to `spec.md`** before implementing any change. Each change must be described as one or more user stories in `spec.md`.

2. **Every user story must be covered by at least one test.** No user story may be considered implemented without a corresponding test that exercises it.

3. **All tests must pass** before a change is considered done. Do not merge or commit incomplete work where any test is failing.

4. **The production build must pass** (`npm run build`) before a change is considered done. A change that breaks the build is not complete.

## Summary

| Step | Requirement |
|------|-------------|
| 1 | Add user story/stories to `spec.md` |
| 2 | Write at least one test per user story |
| 3 | All tests pass |
| 4 | Production build passes (`npm run build`) |

Only when all four steps are complete is a change considered done.
