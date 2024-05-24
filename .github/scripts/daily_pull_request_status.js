const { WebClient } = require('@slack/web-api');
const axios = require('axios');
require('dotenv').config();

const githubToken = process.env.GITHUB_TOKEN;
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const repositoryOwner = 'LeeJ1Hyun';
const repositoryName = 'noti-pr';
const repositoryFullName = `${repositoryOwner}/${repositoryName}`;

const web = new WebClient(slackBotToken);

function escapeHtml(unsafe) {
    return unsafe.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

        const [reviewResponse, commentResponse] = await Promise.all([
            axios.get(`https://api.github.com/repos/${repositoryFullName}/pulls/${prNumber}/reviews`, {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                },
            }),
            axios.get(`https://api.github.com/repos/${repositoryFullName}/issues/${prNumber}/comments`, {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                },
            })
        ]);

        const reviewCount = reviewResponse.data.length;
        const commentCount = commentResponse.data.length;

        const hasComments = commentCount > 0 || reviewCount > 0;

        // 디버깅: 리뷰 데이터를 출력
        console.log(`PR #${prNumber} 리뷰 데이터:`, reviewResponse.data);

        // 수정된 부분: 두 명 이상에게 APPROVED를 받았는지 확인하는 부분
        const approvedReviews = reviewResponse.data.filter((review) => review.state === 'APPROVED');
        console.log(`PR #${prNumber} 승인된 리뷰 수: ${approvedReviews.length}`);
        const isApprovedByTwoOrMore = approvedReviews.length >= 2; // 두 명 이상 APPROVED 확인
        console.log(isApprovedByTwoOrMore: ${isApprovedByTwoOrMore}`);
        
        // const isApproved = reviewResponse.data.some((review) => review.state === 'APPROVED');
        const hasWipLabel = pr.labels.some((label) => label.name.toUpperCase() === 'WIP');

        const dLabel = pr.labels.find((label) => label.name.match(/^D-\d+$/));
        const shouldNotify = (!hasComments && !isApprovedByTwoOrMore && !hasWipLabel) || (dLabel && !hasComments && !isApprovedByTwoOrMore && !hasWipLabel);

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

    prsToNotify.sort((a, b) => {
        if (a.dLabelNumber !== Infinity && b.dLabelNumber === Infinity) {
            return -1;
        } else if (a.dLabelNumber === Infinity && b.dLabelNumber !== Infinity) {
            return 1;
        } else {
            return a.dLabelNumber - b.dLabelNumber;
        }
    });

    const prLinks = prsToNotify.filter((pr) => pr.shouldNotify).map((pr) => ({
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `<${pr.html_url}|${escapeHtml(pr.title)}>`
        }
    }));

    const prsToNotifyCount = prLinks.length;

    let messageBlocks = [];

    if (prsToNotifyCount >= 7) {
        messageBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<!here> 🥹 이제는! 더 이상! 물러날 곳이 없다! <https://github.com/${repositoryFullName}/pulls|리뷰어 찾는 PR들> 보러 갈까요?`
            }
        });
    } else if (prsToNotifyCount > 0) {
        messageBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<!here> 📢 리뷰를 기다리고 있는 PR이 ${prsToNotifyCount}개 있어요!`
            }
        });

        prLinks.forEach((prLink) => {
            messageBlocks.push(prLink);
        });
    } else {
        messageBlocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `<!here> 🥳 리뷰를 기다리는 PR이 없어요!`
            }
        });
    }

    await web.chat.postMessage({
        channel: '일기장',
        blocks: messageBlocks,
        unfurl_links: false,
    });
}

sendNotification().catch(console.error);
