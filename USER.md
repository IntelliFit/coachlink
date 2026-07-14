# USER.md

- Name: 马健文
- Preferred address: 马健文
- Timezone: Asia/Shanghai

## Working preference

- Wants concrete coding execution, not generic explanations.
- Expects clear project ownership when asking "who is responsible for what".
- Across all projects, does not want the agent to run frontend/browser/DevTools/manual UI verification by default because it is slow and unreliable. Leave frontend verification to the user unless the user explicitly asks the agent to run it.
- Does not want full E2E run for every ordinary feature change or push. Run E2E only when explicitly requested or when the change directly affects an E2E-covered flow.
- For small, targeted fixes, do not automatically run broad lint/typecheck/build/test suites after the relevant code or data is corrected; only run them when the user explicitly asks or when a release gate truly requires them.
- To inspect a specific user's real frontend state, first obtain the user ID and use the Web quick-login input with that ID. Prefer this over switching mini-program login state; Web and mini-program share the underlying user/plan data, while UI-specific rendering should still be diagnosed in its owning client when necessary.
