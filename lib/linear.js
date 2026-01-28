import 'dotenv/config';
import { LinearClient } from '@linear/sdk';

/**
 * Linear GraphQL API Integration
 * 
 * Wrapper for Linear SDK to handle issue management, comments, status updates.
 */

let linearClient = null;

/**
 * Initialize Linear client
 */
function getLinearClient() {
    if (!linearClient) {
        const apiKey = process.env.LINEAR_API_KEY;
        if (!apiKey) {
            throw new Error('LINEAR_API_KEY environment variable is required');
        }

        linearClient = new LinearClient({ apiKey });
    }
    return linearClient;
}

/**
 * Get a Linear issue with full context
 * 
 * @param {string} issueId - Linear issue ID or identifier (e.g., 'SYS-353')
 * @returns {Promise<Object>} Issue object with labels, description, attachments
 */
export async function getLinearIssue(issueId) {
    const client = getLinearClient();

    try {
        // Try to get issue by identifier first (e.g., 'SYS-353')
        const issue = await client.issue(issueId);

        if (!issue) {
            throw new Error(`Issue ${issueId} not found`);
        }

        // Fetch related data
        const [labels, attachments, project, team] = await Promise.all([
            issue.labels(),
            issue.attachments(),
            issue.project,
            issue.team
        ]);

        return {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description || '',
            url: issue.url,
            status: issue.state?.name || 'Unknown',
            priority: issue.priority,
            labels: labels.nodes.map(l => l.name),
            attachments: attachments.nodes.map(a => ({
                id: a.id,
                url: a.url,
                title: a.title
            })),
            project: project ? {
                id: project.id,
                name: project.name
            } : null,
            team: {
                id: team.id,
                key: team.key,
                name: team.name
            },
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt
        };
    } catch (error) {
        console.error(`Failed to get Linear issue ${issueId}:`, error);
        throw new Error(`Failed to get Linear issue: ${error.message}`);
    }
}

/**
 * Create a comment on a Linear issue
 * 
 * @param {string} issueId - Linear issue ID (UUID, not identifier)
 * @param {string} body - Comment body in Markdown
 * @returns {Promise<Object>} Created comment
 */
export async function createLinearComment(issueId, body) {
    const client = getLinearClient();

    try {
        const comment = await client.createComment({
            issueId,
            body
        });

        return {
            id: comment.comment.id,
            body: comment.comment.body,
            createdAt: comment.comment.createdAt
        };
    } catch (error) {
        console.error(`Failed to create comment on ${issueId}:`, error);
        throw new Error(`Failed to create Linear comment: ${error.message}`);
    }
}

/**
 * Update a Linear issue status
 * 
 * @param {string} issueId - Linear issue ID (UUID, not identifier)
 * @param {string} stateName - Status name (e.g., 'In Progress', 'Done', 'Backlog')
 * @returns {Promise<Object>} Updated issue
 */
export async function updateLinearIssueStatus(issueId, stateName) {
    const client = getLinearClient();

    try {
        // Get the issue to find its team
        const issue = await client.issue(issueId);
        const team = await issue.team;

        // Get all workflow states for this team
        const states = await team.states();

        // Find the target state by name
        const targetState = states.nodes.find(
            s => s.name.toLowerCase() === stateName.toLowerCase()
        );

        if (!targetState) {
            throw new Error(`Status "${stateName}" not found in team "${team.name}"`);
        }

        // Update issue status
        const response = await client.updateIssue(issueId, {
            stateId: targetState.id
        });

        return {
            id: response.issue.id,
            identifier: response.issue.identifier,
            status: targetState.name
        };
    } catch (error) {
        console.error(`Failed to update status for ${issueId}:`, error);
        throw new Error(`Failed to update Linear issue status: ${error.message}`);
    }
}

/**
 * Format a Linear issue for V0 prompt
 * 
 * Optimized for UI generation - emphasizes:
 * - Visual/UX requirements
 * - Component composition
 * - Design system constraints
 * - Accessibility needs
 * 
 * @param {Object} issue - Linear issue from getLinearIssue()
 * @returns {string} V0-optimized prompt
 */
export function formatLinearIssueForV0(issue) {
    const { title, description, labels = [] } = issue;

    // Detect UI-relevant labels
    const hasLabel = (keywords) => labels.some(l =>
        keywords.some(k => l.toLowerCase().includes(k))
    );

    const darkMode = hasLabel(['dark', 'theme']);
    const responsive = hasLabel(['responsive', 'mobile']);
    const a11y = hasLabel(['a11y', 'accessibility', 'wcag']);
    const shadcn = hasLabel(['shadcn', 'ui']);

    let prompt = `# Component: ${title}\n\n`;

    // Requirements from description
    if (description) {
        prompt += `## Requirements\n${description}\n\n`;
    }

    // Tech stack (V0 defaults)
    prompt += `## Tech Stack\n`;
    prompt += `- **Framework**: Next.js 14+ (App Router)\n`;
    prompt += `- **Styling**: Tailwind CSS\n`;
    prompt += `- **Components**: ${shadcn ? 'shadcn/ui' : 'Custom components'}\n`;
    prompt += `- **Language**: TypeScript (strict)\n`;
    prompt += `- **Icons**: Lucide React\n\n`;

    // Design constraints from labels
    const hasDesignRequirements = darkMode || responsive || a11y;
    if (hasDesignRequirements) {
        prompt += `## Design Requirements\n`;
        if (darkMode) {
            prompt += `- ✅ **Dark mode**: Use Tailwind's dark: variants with proper color contrast\n`;
        }
        if (responsive) {
            prompt += `- ✅ **Responsive**: Mobile-first with sm:/md:/lg: breakpoints\n`;
        }
        if (a11y) {
            prompt += `- ✅ **Accessibility**: WCAG 2.1 AA compliance\n`;
            prompt += `  - Semantic HTML (nav, main, article, etc)\n`;
            prompt += `  - ARIA labels where needed\n`;
            prompt += `  - Keyboard navigation support\n`;
            prompt += `  - Sufficient color contrast (4.5:1 minimum)\n`;
        }
        prompt += `\n`;
    }

    // Best practices
    prompt += `## Implementation Guidelines\n`;
    prompt += `- Use Server Components by default (add "use client" only when needed)\n`;
    prompt += `- Implement proper TypeScript types for all props\n`;
    prompt += `- Use Tailwind utility classes (avoid custom CSS)\n`;
    prompt += `- Add hover/focus states for interactive elements\n`;
    prompt += `- Ensure components are reusable and composable\n`;
    prompt += `- Use Next.js Image component for images\n`;

    return prompt;
}

/**
 * Get the authenticated Linear user (V0 agent)
 * 
 * @returns {Promise<Object>} Current user
 */
export async function getLinearViewer() {
    const client = getLinearClient();

    try {
        const viewer = await client.viewer;
        return {
            id: viewer.id,
            name: viewer.name,
            email: viewer.email
        };
    } catch (error) {
        console.error('Failed to get Linear viewer:', error);
        throw new Error(`Failed to get Linear viewer: ${error.message}`);
    }
}
