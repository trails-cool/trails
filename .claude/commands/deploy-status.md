Check the currently deployed version on production.

Run this SSH command to get the image digests and match them to git SHAs:

```bash
ssh -i ~/.ssh/trails-cool-deploy root@91.99.14.111 "docker compose -f /opt/trails-cool/docker-compose.yml images" 2>&1
```

Then compare with the latest CD run:

```bash
gh run list --workflow cd.yml --limit 1 --json headSha,conclusion,status -q '.[0]'
```

Show:
- Which images are running (journal, planner, brouter, postgres, caddy)
- The git SHA they were built from (matches the image tag)
- Whether the latest CD run matches what's deployed
- Quick health check: curl both https://trails.cool and https://planner.trails.cool
