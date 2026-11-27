# Vendored packages

Current: carl0010-quiet-pro-0.8.0.tgz from 6486de4bc091127e83b9d901653f3e35e5901bef (commit 6486de4)

Quiet Pro, Agency's design system, lives in the private repository `Carl0010/design-system`
(docs site, tokens and components). It is vendored here as an `npm pack` file so that installs,
CI and deploys need no access to that repository.

Update it with `npm run quiet-pro:update -- <tag-or-commit>`, then run `npm test`: the contrast
tests resolve Agency's `var(--…)` tokens through the new package.
