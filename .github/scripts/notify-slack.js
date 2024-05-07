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
    const dLabel = pr.labels.find((label) => label.name.match(/^D-\d+$/));

    return {
      title: `${dLabel ? `[${dLabel.name}] ` : ''}${pr.title}`,
      html_url: pr.html_url,
      shouldNotify: !hasComments && !isApproved && !hasWipLabel && dLabel,
    };
  }));

  const prsToNotifySorted = prsToNotify.sort((a, b) => {
  // Extract D-N label numbers from PR titles
  const dLabelNumberA = a.title.match(/\[D-(\d+)\]/);
  const dLabelNumberB = b.title.match(/\[D-(\d+)\]/);

  if (dLabelNumberA && dLabelNumberB) {
    const numA = parseInt(dLabelNumberA[1]);
    const numB = parseInt(dLabelNumberB[1]);
    return numA - numB;
  } else if (dLabelNumberA) {
    return -1;
  } else if (dLabelNumberB) {
    return 1;
  } else {
    return 0;
  }
});

  const prsToNotifyCount = prsToNotifySorted.filter((pr) => pr.shouldNotify).length;
  const prLinks = prsToNotifySorted.filter((pr) => pr.shouldNotify).map((pr) => `<${pr.html_url}|${pr.title}>`);
  if (prsToNotifyCount >= 7) {
    const message = `<!here> 🥹 한 걸음 뒤엔 항상 내가 있었는데 그대.. 리뷰를 기다리고 있는 PR이 ${prsToNotifyCount}개나 있어요!`;
    await axios.post(slackWebhookUrl, { text: message });
  } else if (prLinks.length > 0) {
    const message = `<!here> 📢 리뷰를 기다리고 있는 PR이 ${prsToNotifyCount}개 있어요!\n${prLinks.join('\n')}`;
    await axios.post(slackWebhookUrl, { text: message });
  } else {
    const message = `<!here> 🥳 리뷰를 기다리는 PR이 없어요!`;
    await axios.post(slackWebhookUrl, { text: message });
  }
}

notifySlack().catch((error) => {
  console.error('Error notifying Slack:', error);
});
