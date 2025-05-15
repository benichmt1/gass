const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// This is a test change to verify the code review functionality
// The code review should evaluate this comment and the overall code quality

const email = process.env.O2_EMAIL;
const password = process.env.O2_PASSWORD;
const appId = process.env.O2_APP_ID;
const propListId = process.env.O2_PROP_LIST_ID;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const prDiff = process.env.PR_DIFF;

const githubUsername = process.env.GITHUB_ACTOR || "unknown";
const repo = process.env.GITHUB_REPOSITORY || "unknown-repo";

if (!email || !password || !appId || !propListId || !openRouterApiKey) {
  console.error("Missing one or more required environment variables: O2_EMAIL, O2_PASSWORD, O2_APP_ID, O2_PROP_LIST_ID, OPENROUTER_API_KEY");
  process.exit(1);
}

async function getCodeReviewScore(diff) {
  const prompt = `Please review this code diff and provide a quality score from 0-100. Consider:
1. Code quality and readability
2. Best practices and patterns
3. Potential bugs or issues
4. Documentation and comments
5. Test coverage (if applicable)

Here's the diff:
${diff}

Provide your response in this exact format:
Score: [number between 0-100]
Reasoning: [brief explanation]`;

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

  const data = await response.json();
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