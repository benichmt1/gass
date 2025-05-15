const fetch = require('node-fetch');

const email = "admin@team02.o2";
const password = "Qm9!ceiVsz7";
const appId = "34ab6196-e0d5-4d55-8115-5067f9e072df";

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