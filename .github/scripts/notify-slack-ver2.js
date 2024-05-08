const { WebClient } = require('@slack/web-api');
const axios = require('axios');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const repositoryOwner = 'LeeJ1Hyun';
const repositoryName = 'noti-pr';
const repositoryFullName = `${repositoryOwner}/${repositoryName}`;

const web = new WebClient(slackBotToken);

async function getPRsToNotify() {
  const response = await axios.get(`https://api.github.com/repos/${repositoryFullName}/pulls`, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
    },
    params: {
      state: 'open',
      sort: 'created',
      direction: 'asc',
    },
  });

  const prsToNotify = await Promise.all(response.data.map(async (pr) => {
    const prNumber = pr.number;
    const reviewResponse = await axios.get(`https://api.github.com/repos/${repositoryFullName}/pulls/${prNumber}/reviews`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    });
    const commentResponse = await axios.get(`https://api.github.com/repos/${repositoryFullName}/issues/${prNumber}/comments`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    });

    const reviewCount = reviewResponse.data.length;
    const commentCount = commentResponse.data.length;

    const hasComments = commentCount > 0;
    const isApproved = reviewCount > 0 && reviewResponse.data.some((review) => review.state === 'APPROVED');
    const hasWipLabel = pr.labels.some((label) => label.name.toLowerCase() === 'wip');

    const dLabel = pr.labels.find((label) => label.name.match(/^D-\d+$/));
    const shouldNotify = (!hasComments && !isApproved && !hasWipLabel) || (dLabel && !hasComments && !isApproved && !hasWipLabel);

    return {
      title: `${dLabel ? `[${dLabel.name}] ` : ''}${pr.title}`,
      html_url: pr.html_url,
      shouldNotify: shouldNotify,
      dLabelNumber: dLabel ? parseInt(dLabel.name.match(/\d+/)[0]) : Infinity,
    };
  }));

  return prsToNotify;
}

async function sendNotification() {
  const prsToNotify = await getPRsToNotify();

  // 정렬 기준에 따라 PR을 우선순위에 따라 정렬
  prsToNotify.sort((a, b) => {
    // D-N label 유무에 따라 정렬
    if (a.dLabelNumber !== Infinity && b.dLabelNumber === Infinity) {
      return -1;
    } else if (a.dLabelNumber === Infinity && b.dLabelNumber !== Infinity) {
      return 1;
    } else {
      return a.dLabelNumber - b.dLabelNumber;
    }
  });

  const prLinks = prsToNotify.filter((pr) => pr.shouldNotify).map((pr) => {
  const urlWithoutProtocol = pr.html_url.replace(/^https?:\/\//, '');
  return `<${urlWithoutProtocol}|${pr.title}>`;
});

  const prsToNotifyCount = prLinks.length;

  if (prsToNotifyCount >= 7) {
    const message = `<!here> 🥹 이제는! 더 이상! 물러날 곳이 없다! <${`https://github.com/${repositoryFullName}/pulls`}|리뷰어 찾는 PR들> 보러 갈까요?`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
      unfurl_links: false,
    });
  } else if (prsToNotifyCount > 0) {
    const message = `<!here> 📢 리뷰를 기다리고 있는 PR이 ${prsToNotifyCount}개 있어요!\n${prLinks.join('\n')}`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
      unfurl_links: false,
    });
  } else {
    const message = `<!here> 🥳 리뷰를 기다리는 PR이 없어요!`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
    });
  }
}

sendNotification().catch(console.error);
