const axios = require('axios');

async function notifySlack() {
  const githubToken = process.env.GITHUB_TOKEN;
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const response = await axios.get('https://api.github.com/repos/LeeJ1Hyun/noti-pr/pulls', {
    headers: {
      Authorization: `Bearer ${githubToken}`,
    },
    params: {
      state: 'open',
      sort: 'created',
      direction: 'desc',
    },
  });

  const prsToNotify = await Promise.all(response.data.map(async (pr) => {
    const prNumber = pr.number;
    const reviewResponse = await axios.get(`https://api.github.com/repos/LeeJ1Hyun/noti-pr/pulls/${prNumber}/reviews`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    });
    const commentResponse = await axios.get(`https://api.github.com/repos/LeeJ1Hyun/noti-pr/issues/${prNumber}/comments`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    });

    const reviewCount = reviewResponse.data.length;
    const commentCount = commentResponse.data.length;

    const hasComments = commentCount > 0;
    const isApproved = reviewCount > 0 && reviewResponse.data.some((review) => review.state === 'APPROVED');
    const hasWipLabel = pr.labels.some((label) => label.name.toLowerCase() === 'wip');

    // Check if the PR has the d-n label
    const dLabel = pr.labels.find((label) => label.name.match(/^d-\d+$/));

    return {
      title: `${dLabel ? `[${dLabel.name}] ` : ''}${pr.title}`,
      html_url: pr.html_url,
      shouldNotify: !hasComments && !isApproved && !hasWipLabel && dLabel,
    };
  }));

  const prLinks = prsToNotify.filter((pr) => pr.shouldNotify).map((pr) => `<${pr.html_url}|${pr.title}>`);
  if (prLinks.length > 0) {
    const message = `😎 리뷰를 기다리고 있는 PR들이 있어요!\n${prLinks.join('\n')}`;
    await axios.post(slackWebhookUrl, { text: message });
  } else {
    console.log('No PRs to notify about.');
  }
}

notifySlack().catch((error) => {
  console.error('Error notifying Slack:', error);
});
