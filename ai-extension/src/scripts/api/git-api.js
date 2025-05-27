export class GitAPI {
    constructor(token) {
        this.token = token;
        this.apiBase = 'https://api.github.com';
    }

    async pushFile({ gitUrl, repoName, branchName, fileName, content, commitMessage }) {
        // Parse owner from gitUrl
        const match = gitUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)\.git/);
        if (!match) throw new Error('Invalid GitHub URL');
        const owner = match[1];
        const repo = match[2];

        // Get latest commit SHA
        const branchRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
            headers: { Authorization: `token ${this.token}` }
        });
        if (!branchRes.ok) throw new Error('Failed to get branch info');
        const branchData = await branchRes.json();
        const latestCommitSha = branchData.object.sha;

        // Get tree SHA
        const commitRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
            headers: { Authorization: `token ${this.token}` }
        });
        const commitData = await commitRes.json();
        const treeSha = commitData.tree.sha;

        // Create blob
        const blobRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            headers: {
                Authorization: `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                encoding: 'utf-8'
            })
        });
        const blobData = await blobRes.json();

        // Create tree
        const treeRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/trees`, {
            method: 'POST',
            headers: {
                Authorization: `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base_tree: treeSha,
                tree: [{
                    path: fileName,
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.sha
                }]
            })
        });
        const treeData = await treeRes.json();

        // Create commit
        const newCommitRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/commits`, {
            method: 'POST',
            headers: {
                Authorization: `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: commitMessage,
                tree: treeData.sha,
                parents: [latestCommitSha]
            })
        });
        const newCommitData = await newCommitRes.json();

        // Update branch
        const updateRes = await fetch(`${this.apiBase}/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
            method: 'PATCH',
            headers: {
                Authorization: `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sha: newCommitData.sha
            })
        });

        if (!updateRes.ok) throw new Error('Failed to update branch');
        return true;
    }
}