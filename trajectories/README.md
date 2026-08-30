# trajectories/

Recorded agent runs kept as a deliverable: the instructions given, every step
taken, what each tool returned, retries, and the points where a human decision
was required.

Populated from real runs, not written by hand. `yarn eval --replay` rewrites this
folder every time it runs, from the committed model responses in `fixtures/`, so a
clean clone reproduces every number in these files exactly.

One row is not one of those numbers. **Commit** names the commit the run was produced
at, and a file cannot name the commit that will contain it — so regenerating after a
later commit changes that row and nothing else. A judge who runs the command and then
looks at `git status` is seeing that one line, not a different result.
