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
  console.log("Access token:", loginData.token);

  // 2. Get property lists for your app
  const propListRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginData.token}`,
      }
    }
  );
  const propListData = await propListRes.json();
  console.log("Property lists:", propListData);
}

main().catch(console.error);