const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const { SLACK_CAHNNEL_ID } = process.env;

async function main() {
  const owner = process.env.GITHUB_REPOSITORY.split("/")[0];
  const repo = process.env.GITHUB_REPOSITORY.split("/")[1];

  const { data: pullRequests } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
    sort: "updated",
    direction: "desc"
  });

  const messages = await collectMessages(pullRequests);
  await sendMessage(messages);
}

async function collectMessages(pullRequests) {
  return pullRequests.flatMap((pr) => {
    if (isDraft(pr) || isAlreadyReviewed(pr)) return [];
    else return [constructMessage(pr)];
  });
}

async function sendMessage(messages) {
  if (messages.length === 0) return;

  const threadStartMessage = await slackClient.chat.postMessage({
    text: "리뷰해주세요!",
    channel: SLACK_CAHNNEL_ID
  });

  await Promise.all(
    messages.map((message) => {
      return slackClient.chat.postMessage({
        text: message.text,
        channel: SLACK_CAHNNEL_ID,
        thread_ts: threadStartMessage.ts
      });
    })
  );
}

main();
