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

  const prsToNotify = response.data.filter((pr) => {
    const hasComments = pr.comments > 0;
    const isApproved = pr.approved && pr.approved.some((review) => review.state === 'APPROVED');
    const hasWipLabel = pr.labels.some((label) => label.name.toLowerCase() === 'wip');

    return !hasComments && !isApproved && !hasWipLabel;
  });

  const prLinks = prsToNotify.map((pr) => pr.html_url);
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
