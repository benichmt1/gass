const fetch = require('node-fetch');

// Use environment variables for sensitive credentials
const email = process.env.O2_EMAIL;
const password = process.env.O2_PASSWORD;
const appId = process.env.O2_APP_ID;

// Check for required environment variables
if (!email || !password || !appId) {
  console.error("Missing one or more required environment variables: O2_EMAIL, O2_PASSWORD, O2_APP_ID");
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

  // 2. Get property lists for your app
  const propListRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    }
  );
  const propListData = await propListRes.json();
  console.log("Property lists:", JSON.stringify(propListData, null, 2));
}

main().catch(console.error);