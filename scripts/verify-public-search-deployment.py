"""Check the production Actions setup without reading or emitting secret values."""
import re
from pathlib import Path

# Use public, checked-in runtime configuration, not the auto-generated Cloud config.
runtime = Path("vite.config.ts").read_text()
match = re.search(r'projectId:\s*"([a-z0-9]+)"', runtime)
if not match:
    raise SystemExit("Production runtime configuration not found")
print("Runtime target is defined in checked-in configuration.")
print("Required operator check: confirm GitHub production deployment targets this same runtime.")
print("Do not print, hash, compare, or export the value of a GitHub secret.")
print("Required before activation: apply a service-role-only atomic consume_public_presence_search RPC.")
print("Required before activation: configure PUBLIC_PRESENCE_SEARCH_ENABLED=true on that runtime.")
print("Deploy only public-digital-presence; never deploy the unrestricted legacy search handler anonymously.")