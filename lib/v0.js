import 'dotenv/config';

/**
 * V0 Platform API Integration
 * 
 * Wrapper for V0 SDK to handle UI component generation sessions.
 * V0 specializes in Next.js 14+ App Router with Tailwind CSS + shadcn/ui.
 */

// Note: v0-sdk is in beta - exact API may differ
// This implementation is based on assumed SDK patterns
// TODO: Update once official v0-sdk documentation is available

let v0Client = null;

/**
 * Initialize V0 client
 */
function getV0Client() {
    if (!v0Client) {
        const apiKey = process.env.V0_API_KEY;
        if (!apiKey) {
            throw new Error('V0_API_KEY environment variable is required');
        }

        // Assuming v0-sdk exports a client constructor
        // TODO: Verify actual SDK API when documentation is available
        try {
            const { V0Client } = await import('v0-sdk');
            v0Client = new V0Client({ apiKey });
        } catch (error) {
            console.warn('v0-sdk import failed - API may not be available yet:', error.message);
            // For now, we'll create a mock for development
            v0Client = createMockV0Client();
        }
    }
    return v0Client;
}

/**
 * Create a new V0 session for UI component generation
 * 
 * @param {Object} params
 * @param {string} params.prompt - Natural language description of UI to generate
 * @param {Object} params.context - Additional context (tech stack, design system, etc)
 * @returns {Promise<{chatId: string, demoUrl: string, files: Array}>}
 */
export async function createV0Session({ prompt, context = {} }) {
    const client = getV0Client();

    try {
        // V0 Platform API call - exact method TBD
        // Assumed pattern based on typical AI SDK structure
        const response = await client.chat.create({
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            // V0-specific parameters
            framework: context.framework || 'next',
            styling: context.styling || 'tailwind',
            ...context
        });

        return {
            chatId: response.id,
            demoUrl: response.demoUrl || `https://v0.dev/chat/${response.id}`,
            files: response.files || [],
            metadata: {
                createdAt: new Date().toISOString(),
                framework: context.framework || 'next',
                styling: context.styling || 'tailwind'
            }
        };
    } catch (error) {
        console.error('V0 session creation failed:', error);
        throw new Error(`Failed to create V0 session: ${error.message}`);
    }
}

/**
 * Continue an existing V0 chat session with refinement feedback
 * 
 * @param {Object} params
 * @param {string} params.chatId - Existing V0 chat ID
 * @param {string} params.feedback - User refinement feedback
 * @returns {Promise<{chatId: string, demoUrl: string, files: Array}>}
 */
export async function continueV0Session({ chatId, feedback }) {
    const client = getV0Client();

    try {
        // Continue existing chat session
        const response = await client.chat.continue({
            chatId,
            message: feedback
        });

        return {
            chatId: response.id || chatId,
            demoUrl: response.demoUrl || `https://v0.dev/chat/${chatId}`,
            files: response.files || [],
            metadata: {
                refinedAt: new Date().toISOString(),
                iterationCount: response.iterationCount || 1
            }
        };
    } catch (error) {
        console.error('V0 session continuation failed:', error);
        throw new Error(`Failed to continue V0 session ${chatId}: ${error.message}`);
    }
}

/**
 * Get generated files from a V0 session
 * 
 * @param {string} chatId - V0 chat ID
 * @returns {Promise<Array<{path: string, content: string, language: string}>>}
 */
export async function getV0SessionFiles(chatId) {
    const client = getV0Client();

    try {
        // Retrieve files from session
        const response = await client.chat.getFiles({ chatId });

        return response.files.map(file => ({
            path: file.path,
            content: file.content,
            language: file.language || inferLanguageFromPath(file.path)
        }));
    } catch (error) {
        console.error('Failed to retrieve V0 session files:', error);
        throw new Error(`Failed to get files for session ${chatId}: ${error.message}`);
    }
}

/**
 * Format a Linear issue into a V0-optimized prompt
 * 
 * V0 specializes in UI generation, so we emphasize:
 * - Visual/UX requirements
 * - Responsive design needs
 * - Dark mode support
 * - Accessibility requirements
 * - Component composition
 * 
 * @param {Object} issue - Linear issue object
 * @returns {string} V0-optimized prompt
 */
export function formatIssueForV0Prompt(issue) {
    const { title, description, labels = [] } = issue;

    // Extract UI-relevant labels
    const darkMode = labels.some(l => l.toLowerCase().includes('dark'));
    const responsive = labels.some(l => l.toLowerCase().includes('responsive'));
    const a11y = labels.some(l => l.toLowerCase().includes('a11y') || l.toLowerCase().includes('accessibility'));

    let prompt = `# Component Request: ${title}\n\n`;

    if (description) {
        prompt += `## Requirements\n${description}\n\n`;
    }

    // V0-specific tech stack constraints
    prompt += `## Tech Stack\n`;
    prompt += `- Framework: Next.js 14+ (App Router)\n`;
    prompt += `- Styling: Tailwind CSS\n`;
    prompt += `- Components: shadcn/ui\n`;
    prompt += `- Language: TypeScript (strict mode)\n\n`;

    // Design requirements from labels
    if (darkMode || responsive || a11y) {
        prompt += `## Design Requirements\n`;
        if (darkMode) prompt += `- ✅ Dark mode support with proper color schemes\n`;
        if (responsive) prompt += `- ✅ Fully responsive (mobile, tablet, desktop)\n`;
        if (a11y) prompt += `- ✅ WCAG 2.1 AA accessibility compliance\n`;
        prompt += `\n`;
    }

    // Best practices
    prompt += `## Additional Guidelines\n`;
    prompt += `- Use semantic HTML elements\n`;
    prompt += `- Implement proper TypeScript types\n`;
    prompt += `- Use Tailwind's design tokens (colors, spacing)\n`;
    prompt += `- Ensure components are reusable and composable\n`;
    prompt += `- Add hover/focus states for interactive elements\n`;

    return prompt;
}

/**
 * Helper: Infer file language from path
 */
function inferLanguageFromPath(path) {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'css': 'css',
        'json': 'json',
        'md': 'markdown'
    };
    return languageMap[ext] || 'plaintext';
}

/**
 * Mock V0 client for development (until SDK is available)
 * TEMPORARY - Remove once v0-sdk is stable
 */
function createMockV0Client() {
    console.warn('Using MOCK V0 client - real API not available');

    return {
        chat: {
            create: async ({ messages }) => ({
                id: `mock-${Date.now()}`,
                demoUrl: `https://v0.dev/chat/mock-${Date.now()}`,
                files: [
                    {
                        path: 'components/example.tsx',
                        content: '// Mock generated component\nexport default function Example() {\n  return <div>Mock Component</div>;\n}',
                        language: 'typescript'
                    }
                ]
            }),
            continue: async ({ chatId, message }) => ({
                id: chatId,
                demoUrl: `https://v0.dev/chat/${chatId}`,
                files: [
                    {
                        path: 'components/example.tsx',
                        content: '// Mock refined component\nexport default function Example() {\n  return <div>Refined Mock Component</div>;\n}',
                        language: 'typescript'
                    }
                ],
                iterationCount: 2
            }),
            getFiles: async ({ chatId }) => ({
                files: [
                    {
                        path: 'components/example.tsx',
                        content: '// Mock component files',
                        language: 'typescript'
                    }
                ]
            })
        }
    };
}
