const core = require('@actions/core');
const github = require('@actions/github');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const githubToken = core.getInput('github_token');
    const geminiApiKey = core.getInput('gemini_api_key');

    const octokit = github.getOctokit(githubToken);
    const { context } = github;

    const pr = context.payload.pull_request;

    if (!pr) {
      core.setFailed('Không tìm thấy Pull Request.');
      return;
    }

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    for (const file of files) {
      if (file.status !== 'removed') {
        const content = await octokit.rest.repos.getContent({
          owner: context.repo.owner,
          repo: context.repo.repo,
          path: file.filename,
        });

        const code = Buffer.from(content.data.content, 'base64').toString('utf-8');

        const prompt = `Hãy phân tích đoạn mã sau và chỉ ra các vấn đề về logic, bảo mật, cú pháp và coding style:\n\n${code}`;

        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-pro',
        });

        const result = await model.generateContent([prompt]);

        const analysis = result.responses[0].text;

        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: pr.number,
          body: `**Phân tích từ Gemini AI cho file \`${file.filename}\`:**\n\n${analysis}`,
        });
      }
    }
  } catch (error) {
    core.setFailed(`Đã xảy ra lỗi: ${error.message}`);
  }
}

run();
