const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// This is a test change to verify the code review functionality
// The code review should evaluate this comment and the overall code quality

const email = process.env.O2_EMAIL;
const password = process.env.O2_PASSWORD;
const appId = process.env.O2_APP_ID;
const propListId = process.env.O2_PROP_LIST_ID;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const prDiff = fs.existsSync('pr_diff.txt') ? fs.readFileSync('pr_diff.txt', 'utf8') : '';

const githubUsername = process.env.GITHUB_ACTOR || "unknown";
const repo = process.env.GITHUB_REPOSITORY || "unknown-repo";

if (!email || !password || !appId || !propListId || !openRouterApiKey) {
  console.error("Missing one or more required environment variables: O2_EMAIL, O2_PASSWORD, O2_APP_ID, O2_PROP_LIST_ID, OPENROUTER_API_KEY");
  process.exit(1);
}

async function getCodeReviewScore(diff) {
  const prompt = `Please review this code diff and provide a quality score from 0-100. Consider:\n1. Code quality and readability\n2. Best practices and patterns\n3. Potential bugs or issues\n4. Documentation and comments\n5. Test coverage (if applicable)\n\nHere's the diff:\n${diff}\n\nProvide your response in this exact format:\nScore: [number between 0-100]\nReasoning: [brief explanation]`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openRouterApiKey}`,
      "HTTP-Referer": "https://github.com", // Required by OpenRouter
      "X-Title": "Code Review Bot" // Optional but recommended
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-opus-20240229", // Using Claude 3 Opus for best results
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    console.error("OpenRouter API returned HTTP status", response.status);
    throw new Error("OpenRouter API call failed");
  }

  const data = await response.json();
  console.log("OpenRouter API raw response:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    console.error("Unexpected OpenRouter API response format:", data);
    throw new Error("Failed to get code review from OpenRouter API");
  }
  const reviewText = data.choices[0].message.content;
  
  // Extract score from response
  const scoreMatch = reviewText.match(/Score:\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 50; // Default to 50 if parsing fails
  
  console.log("Code review response:", reviewText);
  return score;
}

async function main() {
  // Get code review score
  const score = await getCodeReviewScore(prDiff);
  console.log("Calculated quality score:", score);

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

  // 2. Check if user already exists in property list
  let operation = "create";
  let finalScore = score;
  let reviewCount = 1;
  let repos = [repo];
  try {
    const getRes = await fetch(
      `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows/${githubUsername}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (getRes.ok) {
      const getData = await getRes.json();
      if (getData && getData.quality_score !== undefined && getData.review_count !== undefined && getData.repos !== undefined) {
        // User exists, calculate running average and update repos
        reviewCount = parseInt(getData.review_count) + 1;
        finalScore = Math.round((parseInt(getData.quality_score) * parseInt(getData.review_count) + score) / reviewCount);
        // Merge repos, ensuring uniqueness
        repos = Array.isArray(getData.repos) ? getData.repos.slice() : [];
        if (!repos.includes(repo)) {
          repos.push(repo);
        }
        operation = "update";
        console.log(`User exists. Running average: old=${getData.quality_score}, count=${getData.review_count}, new=${score}, avg=${finalScore}, repos=${repos}`);
      }
    }
  } catch (err) {
    console.warn("Could not check for existing user row (proceeding with create):", err);
  }

  // 3. Push the quality score and metadata
  const now = Math.floor(Date.now() / 1000); // Unix timestamp
  const patchBody = {
    schemas: [
      "urn:ietf:params:scim:api:messages:2.0:PatchOp"
    ],
    Operations: [
      { op: "replace", path: "quality_score", value: finalScore },
      { op: "replace", path: "review_count", value: reviewCount },
      { op: "replace", path: "repos", value: repos },
      { op: "replace", path: "last_updated", value: now },
      { op: "replace", path: "repo", value: repo }
    ]
  };
  console.log("PATCH body:", JSON.stringify(patchBody, null, 2));
  const patchRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows/${githubUsername}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patchBody),
    }
  );
  const patchData = await patchRes.json();
  if (patchData.status !== 'success') {
    console.error("O2 Oracle patch error details:", patchData);
  }
  console.log("Patch response:", patchData);

  // 4. Publish the changes
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