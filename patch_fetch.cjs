const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const newFetchLogic = `
const apiState = {
  usingFallback: false,
  consecutiveFails: 0,
  healthCheckTimer: null as ReturnType<typeof setInterval> | null,

  switchToFallback() {
    if (this.usingFallback) return;
    this.usingFallback = true;
    console.warn('[API] phimapi.com không phản hồi → ophim1.com');
    this.startHealthCheck();
  },
  switchToPrimary() {
    this.usingFallback = false;
    this.consecutiveFails = 0;
    console.info('[API] phimapi.com sống lại ✅');
    this.stopHealthCheck();
  },
  startHealthCheck() {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(async () => {
      try {
        const res = await fetch(\`\${PRIMARY_URL}/v1/api/danh-sach/phim-le?limit=1\`);
        if (res.ok) {
          this.switchToPrimary();
        }
      } catch {}
    }, HEALTH_CHECK_INTERVAL);
  },
  stopHealthCheck() {
    if (this.healthCheckTimer) { clearInterval(this.healthCheckTimer); this.healthCheckTimer = null; }
  },
};

async function apiFetch(endpoint: string): Promise<{ data: any; source: 'primary' | 'fallback' }> {
  const canFallback = isEndpointSupportedOnFallback(endpoint);

  // If we are currently in fallback mode and fallback is supported for this endpoint
  if (apiState.usingFallback && canFallback) {
    try {
      const res = await fetchWithTimeout(\`\${FALLBACK_URL}\${endpoint}\`, PRIMARY_TIMEOUT);
      if (!res.ok) throw new Error(\`Fallback HTTP \${res.status}\`);
      const data = await res.json();
      return { data, source: 'fallback' };
    } catch (e) {
      console.warn('[API] Fallback failed:', e);
    }
  }

  // Otherwise, try primary
  try {
    const res = await fetchWithTimeout(\`\${PRIMARY_URL}\${endpoint}\`, PRIMARY_TIMEOUT);
    if (!res.ok) throw new Error(\`Primary HTTP \${res.status}\`);
    
    // Success, reset consecutive fails
    apiState.consecutiveFails = 0;
    if (apiState.usingFallback) {
      apiState.switchToPrimary();
    }
    
    const data = await res.json();
    return { data, source: 'primary' };
  } catch (err) {
    if (canFallback) {
      apiState.consecutiveFails++;
      if (apiState.consecutiveFails >= 2) {
        apiState.switchToFallback();
      }
      console.warn(\`[API] Primary failed for \${endpoint}, using fallback.\`);
      const res = await fetchWithTimeout(\`\${FALLBACK_URL}\${endpoint}\`, PRIMARY_TIMEOUT);
      if (!res.ok) throw new Error(\`Fallback HTTP \${res.status}\`);
      const data = await res.json();
      return { data, source: 'fallback' };
    }
    throw err;
  }
}
`;

code = code.replace(/\/\/ ─────────────────────────────────────────────────────────────\n\/\/ API STATE — health check \+ failover\n\/\/ PARALLEL FETCH\n\/\/ ─────────────────────────────────────────────────────────────\n\nasync function parallelFetch.*?return \{ data, source \};\n\}/s, newFetchLogic.trim());

fs.writeFileSync('src/lib/api.ts', code);
