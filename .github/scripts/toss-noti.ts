async function main() {
  const owner = process.env.GITHUB_REPOSITORY?.split("/")[0];
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];

  const { data: pullRequests } = await githubClient.rest.pulls.list({
    owner,
    repo,
    state: "open",
    per_page: 100,
    sort: "updated",
    direction: "desc"
  });

  const messages = await collectMessages(pullRequests);
  sendMessage(messages);
}

async function collectMessages(pullRequests: IPullRequest[]): IMessage[] {
  return pullRequests
    .flatMap((pr) => {
      if (isDraft(pr) || isAlreadyReviewed(pr)) return [];
      else return [constructMessage(pr)];
    })
}

async function sendMessage(messages: IMessage[]) {
  if (messages.length === 0) return;

  const threadStartMessage = await slackClient.chat.postMessage({
    text: "리뷰해주세요!",
    channel: process.env.SLACK_CAHNNEL_ID
  });

  Promise.all(
    messages.map((message) => {
      slackClient.chat.postMessage({
        text: message.text,
        channel: process.env.SLACK_CAHNNEL_ID,
        thread_ts = threadStartMessage.ts
      });
    })
  );
}
