const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const email = process.env.O2_EMAIL;
const password = process.env.O2_PASSWORD;
const appId = process.env.O2_APP_ID;
const propListId = process.env.O2_PROP_LIST_ID;

const githubUsername = process.env.GITHUB_ACTOR || "unknown";
const score = process.env.QUALITY_SCORE ? parseInt(process.env.QUALITY_SCORE) : 42; // Placeholder
const repo = process.env.GITHUB_REPOSITORY || "unknown-repo";

if (!email || !password || !appId || !propListId) {
  console.error("Missing one or more required O2 Oracle environment variables: O2_EMAIL, O2_PASSWORD, O2_APP_ID, O2_PROP_LIST_ID");
  process.exit(1);
}

async function main() {
  // 1. Login to get access token
  const loginRes = await fetch("https://sandbox.api.o2-oracle.io/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.error("Login failed:", loginData);
    return;
  }
  const token = loginData.token;

  // 2. Push the quality score
  const now = Math.floor(Date.now() / 1000); // Unix timestamp
  const patchRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: "create",
        rows: {
          [githubUsername]: {
            quality_score: score,
            last_updated: now,
            repo: repo
          }
        }
      }),
    }
  );
  const patchData = await patchRes.json();
  console.log("Patch response:", patchData);

  // 3. Publish the changes
  const publishRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const publishData = await publishRes.json();
  console.log("Publish response:", publishData);
}

main().catch(console.error); 