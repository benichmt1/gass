import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import fetch from 'node-fetch';

// Define inputs
const INPUTS = {
  O2_EMAIL: 'o2_email',
  O2_PASSWORD: 'o2_password',
  O2_APP_ID: 'o2_app_id',
  O2_PROP_LIST_ID: 'o2_prop_list_id',
  OPENROUTER_API_KEY: 'openrouter_api_key'
};

async function getCodeReviewScore(diff: string, openRouterApiKey: string): Promise<number> {
  const prompt = `Please perform a rigorous and critical code review of this diff. Be thorough and strict in your evaluation. Consider:

1. Code Quality & Readability:
   - Is the code clean, well-structured, and easy to understand?
   - Are there any unnecessary complexities or redundancies?
   - Is the code following best practices and design patterns?

2. Potential Issues & Bugs:
   - Are there any obvious bugs or edge cases not handled?
   - Are there security vulnerabilities or performance concerns?
   - Is error handling comprehensive and appropriate?

3. Documentation & Comments:
   - Is the code well-documented with clear comments?
   - Are complex logic sections explained?
   - Is there sufficient inline documentation?

4. Testing & Maintainability:
   - Is the code testable and maintainable?
   - Are there any hardcoded values or magic numbers?
   - Is the code modular and reusable?

5. Best Practices:
   - Does it follow language/framework conventions?
   - Are there any anti-patterns or code smells?
   - Is the code DRY (Don't Repeat Yourself)?

Be particularly critical of:
- Poor error handling
- Lack of documentation
- Code duplication
- Unclear or complex logic
- Security vulnerabilities
- Performance issues
- Inconsistent coding style

Here's the diff:
${diff}

Provide your response in this exact format:
Score: [number between 0-100]
Reasoning: [detailed explanation of issues found and why the score was given]`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openRouterApiKey}`,
      "HTTP-Referer": "https://github.com",
      "X-Title": "Code Review Bot"
    },
    body: JSON.stringify({
      model: "anthropic/claude-3-opus-20240229",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    core.error(`OpenRouter API returned HTTP status ${response.status}`);
    throw new Error("OpenRouter API call failed");
  }

  const data: any = await response.json();
  console.log("OpenRouter API raw response:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    core.error(`Unexpected OpenRouter API response format: ${JSON.stringify(data)}`);
    throw new Error("Failed to get code review from OpenRouter API");
  }
  const reviewText = data.choices[0].message.content;
  
  const scoreMatch = reviewText.match(/Score:\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
  
  console.log("Code review response:", reviewText);
  return score;
}

async function run() {
  try {
    const email = core.getInput(INPUTS.O2_EMAIL, { required: true });
    const password = core.getInput(INPUTS.O2_PASSWORD, { required: true });
    const appId = core.getInput(INPUTS.O2_APP_ID, { required: true });
    const propListId = core.getInput(INPUTS.O2_PROP_LIST_ID, { required: true });
    const openRouterApiKey = core.getInput(INPUTS.OPENROUTER_API_KEY, { required: true });

    // Ensure we are in a PR context
    if (!github.context.payload.pull_request) {
      core.setFailed('This action must run on a pull_request event.');
      return;
    }

    const { base, head } = github.context.payload.pull_request;
    const githubUsername = github.context.actor;
    const repo = github.context.repo.owner + '/' + github.context.repo.repo;

    // Fetch and Diff
    await exec.exec(`git fetch origin ${base.ref}:${base.ref}`);
    await exec.exec(`git fetch origin ${head.ref}:${head.ref}`);
    await exec.exec(`git checkout ${head.ref}`);
    
    let diffOutput = '';
    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          diffOutput += data.toString();
        }
      }
    };
    await exec.exec(`git diff origin/${base.ref}`, [], options);

    if (!diffOutput) {
        console.log("No diff found. Skipping analysis.");
        return;
    }
    
    // Limit diff size to prevent token limits
    const truncatedDiff = diffOutput.substring(0, 10000); 

    const score = await getCodeReviewScore(truncatedDiff, openRouterApiKey);
    core.info(`Calculated quality score: ${score}`);

    // Login to O2
    const loginRes = await fetch("https://sandbox.api.o2-oracle.io/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData: any = await loginRes.json();
      if (!loginData.token) {
        console.error("Login failed:", loginData);
        throw new Error("O2 Login failed");
      }
      const token = loginData.token;

      // Get Rows
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
        throw new Error(`Failed to fetch rows: ${await rowsRes.text()}`);
      }
      const rowsData: any = await rowsRes.json();
      
      const rows = rowsData.data.rows || [];
      let existingUser = rows.find((row: any) => row.index === githubUsername || row.row_id === githubUsername);

      if (!existingUser) {
        existingUser = rows.find((row: any) => row.data && row.data.repo && row.data.repo.split('/')[0] === githubUsername);
      }

      const operation = existingUser ? "update" : "create";
      
      let finalScore = score;
      if (existingUser) {
        const currentScore = existingUser.data.quality_score || 0;
        const commitCount = existingUser.data.review_count || 0;
        finalScore = Math.round((currentScore * commitCount + score) / (commitCount + 1));
      }

      let reposObj = { [repo]: repo };
      if (existingUser && existingUser.data && existingUser.data.repos) {
        reposObj = { ...existingUser.data.repos, [repo]: repo };
      }

      const requestBody = {
        operation: operation,
        rows: {
          [operation === 'update' ? existingUser.row_id : githubUsername]: {
            repo: repo,
            repos: reposObj,
            last_updated: Math.floor(Date.now() / 1000),
            review_count: existingUser ? (existingUser.data.review_count || 0) + 1 : 1,
            quality_score: finalScore
          }
        }
      };

      const createRes = await fetch(
        `https://sandbox.api.o2-oracle.io/apps/${appId}/propertylists/${propListId}/rows`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!createRes.ok) {
        throw new Error(`Failed to create/update row: ${await createRes.text()}`);
      }

      // Publish
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
        throw new Error(`Failed to publish: ${await publishRes.text()}`);
      }
      core.info("Successfully published quality score to O2 Oracle.");

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
