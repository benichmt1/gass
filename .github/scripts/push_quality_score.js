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

  // Get property list details
  console.log("Fetching property list details...");
  const propListRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  if (!propListRes.ok) {
    console.error("Failed to fetch property list:", await propListRes.text());
    throw new Error("Failed to fetch property list");
  }
  
  const propListData = await propListRes.json();
  console.log("Property list details:", JSON.stringify(propListData, null, 2));

  // Get current rows
  console.log("\nFetching current rows...");
  const rowsRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  
  if (!rowsRes.ok) {
    console.error("Failed to fetch rows:", await rowsRes.text());
    throw new Error("Failed to fetch rows");
  }
  
  const rowsData = await rowsRes.json();
  console.log("Current rows:", JSON.stringify(rowsData, null, 2));

  // Check if item exists for this GitHub username
  const existingUser = rowsData[githubUsername];
  const operation = existingUser ? "update" : "create";
  console.log(`\nItem ${operation === 'create' ? 'does not exist' : 'exists'}, will ${operation}`);

  // Calculate the new score
  let finalScore = score;
  if (existingUser) {
    const currentScore = existingUser.quality_score || 0;
    const commitCount = existingUser.commit_count || 0;
    // Calculate weighted average: (current_score * commit_count + new_score) / (commit_count + 1)
    finalScore = Math.round((currentScore * commitCount + score) / (commitCount + 1));
    console.log(`Calculating weighted average: (${currentScore} * ${commitCount} + ${score}) / (${commitCount} + 1) = ${finalScore}`);
  }

  // Create or update property list item with quality score
  console.log(`\n${operation === 'create' ? 'Creating' : 'Updating'} property list item...`);
  const createRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: operation,
        rows: {
          [githubUsername]: {
            quality_score: finalScore,
            commit_count: existingUser ? (existingUser.commit_count || 0) + 1 : 1,
            repository: repo,
            timestamp: new Date().toISOString()
          }
        }
      })
    }
  );

  if (!createRes.ok) {
    console.error("Failed to create/update property list item:", await createRes.text());
    throw new Error("Failed to create/update property list item");
  }

  const createData = await createRes.json();
  console.log("Property list item created/updated:", JSON.stringify(createData, null, 2));

  // Publish the changes
  console.log("\nPublishing changes...");
  const publishRes = await fetch(
    `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    }
  );

  if (!publishRes.ok) {
    console.error("Failed to publish changes:", await publishRes.text());
    throw new Error("Failed to publish changes");
  }

  const publishData = await publishRes.json();
  console.log("Changes published:", JSON.stringify(publishData, null, 2));
}

main().catch(console.error); 