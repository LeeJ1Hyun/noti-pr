const { WebClient } = require('@slack/web-api');
const axios = require('axios');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const web = new WebClient(slackBotToken);

async function getPRsToNotify() {
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
  const prLinks = prsToNotify.filter((pr) => pr.shouldNotify).map((pr) => `<${pr.html_url}|${pr.title}>`);
  const prsToNotifyCount = prLinks.length;

  if (prsToNotifyCount >= 7) {
    const message = `<!here> 🥹 이제는! 더 이상! 물러날 곳이 없다! <${'https://github.com/dealicious-inc/payment-point-server/pulls'}|리뷰어 찾는 PR들> 보러 갈까요?`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
    });
  } else if (prsToNotifyCount > 0) {
    const message = `<!here> 📢 리뷰를 기다리고 있는 PR이 ${prsToNotifyCount}개 있어요!\n${prLinks.join('\n')}`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
    });
  } else {
    const message = `<!here> 🥳 리뷰를 기다리는 PR이 없어요!`;
    await web.chat.postMessage({
      channel: '일기장',
      text: message,
    });
  }
}

sendNotification().catch(console.error); // 이벤트 핸들러 삭제, 바로 알림 전송
