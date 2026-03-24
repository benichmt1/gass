# GASS - Github Activity Scoring System

Automatically scores pull request code quality using AI and stores the results on-chain via the [O2 Oracle](https://o2-oracle.io). Part of the [GASS system](.github/docs/architecture.md) for meritocratic, Sybil-resistant token distribution — but works standalone in any repo that wants on-chain developer metrics.

## Getting Started

### 1. Create an O2 Oracle app

Sign up at [o2-oracle.io](https://o2-oracle.io) and create an app with a property list. The property list schema should include:

| Field | Type |
|-------|------|
| `quality_score` | uint256 |
| `last_updated` | uint256 |
| `review_count` | uint256 |
| `repo` | string |

### 2. Find your credentials

You'll need four values from your O2 Oracle account.

**`O2_APP_ID`** — The ID of your app. Note: this is *not* your organization ID. To find it:

```bash
npm install node-fetch
node -e "
const fetch = require('node-fetch');
(async () => {
  const r = await fetch('https://sandbox.api.o2-oracle.io/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: 'YOUR_EMAIL', password: 'YOUR_PASSWORD'})
  });
  const {token} = await r.json();
  const apps = await fetch('https://sandbox.api.o2-oracle.io/apps', {
    headers: {Authorization: 'Bearer ' + token}
  });
  console.log(JSON.stringify(await apps.json(), null, 2));
})();
"
```

Each app in the response has an `id` — that's your `O2_APP_ID`.

**`O2_PROP_LIST_ID`** — The ID of the property list within your app. Run the included helper after cloning this repo:

```bash
O2_EMAIL=your@email.com O2_PASSWORD=yourpassword O2_APP_ID=your-app-id \
  node .github/scripts/get_property_lists.js
```

Find your list in the output — its `id` field is your `O2_PROP_LIST_ID`.

### 3. Add secrets to your repository

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `O2_EMAIL` | Your O2 Oracle account email |
| `O2_PASSWORD` | Your O2 Oracle account password |
| `O2_APP_ID` | From step 2 |
| `O2_PROP_LIST_ID` | From step 2 |
| `OPENROUTER_API_KEY` | Your [OpenRouter](https://openrouter.ai) API key |

### 4. Add the workflow

Create `.github/workflows/gass.yml` in your repository:

```yaml
name: GASS Analysis
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: GASS Code Quality Score
        uses: michael-bey/gass@v1
        with:
          o2_email: ${{ secrets.O2_EMAIL }}
          o2_password: ${{ secrets.O2_PASSWORD }}
          o2_app_id: ${{ secrets.O2_APP_ID }}
          o2_prop_list_id: ${{ secrets.O2_PROP_LIST_ID }}
          openrouter_api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

That's it. On every PR, the action will fetch the diff, send it to OpenRouter for AI code review, calculate a 0–100 quality score, and update the contributor's record in the O2 Oracle.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `o2_email` | Yes | — | O2 Oracle account email |
| `o2_password` | Yes | — | O2 Oracle account password |
| `o2_app_id` | Yes | — | O2 Oracle app ID |
| `o2_prop_list_id` | Yes | — | O2 Oracle property list ID |
| `openrouter_api_key` | Yes | — | OpenRouter API key |
| `openrouter_model` | No | `anthropic/claude-opus-4.5` | Model to use for code review |

## Use Cases

- Token airdrops based on community contributions
- Retroactive funding for open source developers
- DAO governance token distribution
- Community rewards programs
- Contributor reputation systems

---

**Learn more:** [System Architecture & Token Distribution →](.github/docs/architecture.md)
