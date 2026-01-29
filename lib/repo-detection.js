/**
 * Repository Detection
 *
 * Extracts repository hints from Linear issues using:
 * 1. issueRepositorySuggestions (from AgentSession)
 * 2. GitHub links in issue description
 * 3. Branch references in comments
 */

/**
 * Extract repository URL from Linear issue context
 *
 * @param {Object} agentSession - Linear AgentSession from webhook
 * @returns {{ repoUrl: string | null, source: string }}
 */
export function detectRepository(agentSession) {
    const { issue, issueRepositorySuggestions } = agentSession;

    // 1. Check issueRepositorySuggestions (preferred - Linear's native detection)
    if (issueRepositorySuggestions && issueRepositorySuggestions.length > 0) {
        const suggestion = issueRepositorySuggestions[0];
        return {
            repoUrl: suggestion.url || `https://github.com/${suggestion.owner}/${suggestion.name}`,
            source: 'issueRepositorySuggestions',
            suggestions: issueRepositorySuggestions,
        };
    }

    // 2. Parse GitHub links from description
    const description = issue.description || '';
    const githubUrlMatch = description.match(/https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);

    if (githubUrlMatch) {
        const [fullUrl, owner, repo] = githubUrlMatch;
        // Remove .git suffix if present
        const cleanRepo = repo.replace(/\.git$/, '');
        return {
            repoUrl: `https://github.com/${owner}/${cleanRepo}`,
            source: 'description',
        };
    }

    // 3. Check for branch references (git branch name in issue)
    const branchMatch = issue.branchName?.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
    if (branchMatch) {
        // This pattern suggests org/repo structure - but we need more context
        // For now, return null as we need the full repo URL
    }

    return { repoUrl: null, source: 'none' };
}

/**
 * Generate a V0 project name from Linear issue context
 *
 * @param {Object} issue - Linear issue
 * @returns {string} Project name
 */
export function generateProjectName(issue) {
    // Use issue identifier as unique project name
    return `linear-${issue.identifier}`.toLowerCase();
}

/**
 * Check if repository suggestions are available and need user selection
 *
 * @param {Object} agentSession - Linear AgentSession
 * @returns {boolean}
 */
export function needsRepositorySelection(agentSession) {
    const { issueRepositorySuggestions } = agentSession;
    return issueRepositorySuggestions && issueRepositorySuggestions.length > 1;
}

/**
 * Format repository suggestions for Linear select signal
 *
 * @param {Array} suggestions - issueRepositorySuggestions
 * @returns {Array<{key: string, label: string}>}
 */
export function formatRepoOptionsForSelect(suggestions) {
    return suggestions.map((repo, index) => ({
        key: `repo-${index}`,
        label: `${repo.owner}/${repo.name}`,
        value: repo.url || `https://github.com/${repo.owner}/${repo.name}`,
    }));
}
