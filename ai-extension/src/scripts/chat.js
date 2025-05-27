import { getPrompt } from '../scripts/prompts.js';
import { GitAPI } from './api/git-api.js';

// Constants
const INITIAL_SYSTEM_MESSAGE = ``;

class ChatUI {
    constructor() {
        // Grab references
        this.messagesContainer     = document.getElementById('chatMessages');
        this.inputField            = document.getElementById('chatInput');
        this.sendButton            = document.getElementById('sendMessage');
        this.inspectorButton       = document.getElementById('inspectorButton');
        this.resetButton           = document.getElementById('resetChat');

        // Language / Browser dropdown
        this.languageBindingSelect = document.getElementById('languageBinding');
        this.browserEngineSelect   = document.getElementById('browserEngine');

        // Additional states
        this.selectedDomContent    = null;
        this.isInspecting          = false;
        this.markdownReady         = false;
        this.codeGeneratorType     = 'SELENIUM_JAVA_PAGE_ONLY'; // default 
        this.tokenWarningThreshold = 10000;
        this.selectedModel         = '';
        this.selectedProvider      = '';
        this.generatedCode         = '';

        // Clear existing messages + add initial system message
        this.messagesContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
        this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

        // Initialize everything
        this.initialize();
        this.initializeMarkdown();
        this.initializeTokenThreshold();
        this.initializeCodeGeneratorType();
        this.initializeDownloadButton(); 
        
        // Add this for Push to Git
        const pushBtn = document.getElementById('pushToGit');
        if (pushBtn) {
            pushBtn.addEventListener('click', () => this.pushToGit());
        }

        // Initialize Git settings persistence
        this.initializeGitSettings();
    }

    initialize() {
        // Reset chat
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => {
                this.messagesContainer.innerHTML = '';
                this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
                this.selectedDomContent = null;
                this.inspectorButton.classList.remove('has-content','active');
                this.inspectorButton.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Inspect</span>
                `;
                this.isInspecting = false;
            });
        }

        // Load stored keys
        chrome.storage.sync.get(
            ['groqApiKey','openaiApiKey','watsonxApiKey','selectedModel','selectedProvider'],
            (result) => {
                if (result.groqApiKey)   this.groqAPI   = new GroqAPI(result.groqApiKey);
                if (result.openaiApiKey) this.openaiAPI = new OpenaiAPI(result.openaiApiKey);
                if (result.watsonxApiKey) this.watsonxAPI = new WatsonxAPI(result.watsonxApiKey);

                this.selectedModel    = result.selectedModel    || '';
                this.selectedProvider = result.selectedProvider || '';
            }
        );

        // Listen for changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.groqApiKey)       this.groqAPI   = new GroqAPI(changes.groqApiKey.newValue);
            if (changes.openaiApiKey)     this.openaiAPI = new OpenaiAPI(changes.openaiApiKey.newValue);
            if (changes.watsonxApiKey)    this.watsonxAPI = new WatsonxAPI(changes.watsonxApiKey.newValue);
            if (changes.selectedModel)    this.selectedModel = changes.selectedModel.newValue;
            if (changes.selectedProvider) this.selectedProvider = changes.selectedProvider.newValue;
        });

        // Listen for SELECTED_DOM_CONTENT from content.js
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'SELECTED_DOM_CONTENT') {
                this.selectedDomContent = msg.content;
                this.inspectorButton.classList.add('has-content');
            }
        });

        // Send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Inspector button
        this.inspectorButton.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                    console.log('Cannot use inspector on this page');
                    return;
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (error) {
                    if (!error.message.includes('already been injected')) {
                        throw error;
                    }
                }
                const port = chrome.tabs.connect(tab.id);
                port.postMessage({ type: 'TOGGLE_INSPECTOR', reset: true });
                this.isInspecting = !this.isInspecting;
                this.updateInspectorButtonState();
            } catch (error) {
                console.error('Inspector error:', error);
                this.addMessage('Failed to activate inspector. Please refresh and try again.', 'system');
                this.isInspecting = false;
                this.updateInspectorButtonState();
            }
        });
    }

    initializeDownloadButton() {
        const downloadBtn = document.getElementById('downloadCode');
        if (!downloadBtn) return;
        // Initially disable the button until code is generated
        downloadBtn.disabled = true;
        downloadBtn.addEventListener('click', () => {
            // Turn off the inspector when download is clicked
            this.isInspecting = false;
            this.updateInspectorButtonState();

            if (!this.generatedCode) return;

            // Remove markdown code fences from the generated code
            let finalCode = this.generatedCode.replace(/^```(?:java)?\s*/i, '').replace(/```\s*$/i, '');

            const fileName = this.getGeneratedFileName(finalCode);

            // Create a Blob and trigger download
            const blob = new Blob([finalCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    getGeneratedFileName(finalCode = null) {
        finalCode = finalCode || this.generatedCode || '';
        let fileName = '';
        if (this.codeGeneratorType === 'SELENIUM_JAVA_PAGE_ONLY' || this.codeGeneratorType === 'SELENIUM_JAVA_TEST_ONLY') {
            const match = finalCode.match(/public class\s+(\w+)/);
            fileName = match ? match[1] : 'Generated';
            fileName += '.java';
        } else if (this.codeGeneratorType === 'CUCUMBER_ONLY') {
            const match = finalCode.match(/Feature:\s*(.+)/i);
            fileName = match ? match[1].trim().replace(/[^a-zA-Z0-9]+/g, '_') : 'feature';
            fileName += '.feature';
        } else {
            fileName = 'Generated.txt';
        }
        // Append date and time
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 12); // e.g. 202405281057
        const ext = fileName.substring(fileName.lastIndexOf('.'));
        const base = fileName.substring(0, fileName.lastIndexOf('.'));
        return `${base}_${dateStr}${ext}`;
    }

    // ===================
    // Markdown / Parsing
    // ===================
    initializeMarkdown() {
        const checkLibraries = setInterval(() => {
            if (window.marked && window.Prism) {
                window.marked.setOptions({
                    highlight: (code, lang) => {
                        if (lang && Prism.languages[lang]) {
                            try {
                                return Prism.highlight(code, Prism.languages[lang], lang);
                            } catch (e) {
                                console.error('Prism highlight error:', e);
                                return code;
                            }
                        }
                        return code;
                    },
                    langPrefix: 'language-',
                    breaks: true,
                    gfm: true
                });
                const renderer = new marked.Renderer();
                renderer.code = (code, language) => {
                    if (typeof code === 'object') {
                        if (code.text) {
                            code = code.text;
                        } else if (code.raw) {
                            code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                        } else {
                            code = JSON.stringify(code, null, 2);
                        }
                    }
                    const validLanguage = language?.toLowerCase().trim() || 'typescript';
                    let highlighted = code;
                    if (validLanguage && Prism.languages[validLanguage]) {
                        try {
                            highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                        } catch (e) {
                            console.error('Highlighting failed:', e);
                        }
                    }
                    return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
                };
                window.marked.setOptions({ renderer });
                this.markdownReady = true;
                clearInterval(checkLibraries);
            }
        }, 100);
    }

    parseMarkdown(content) {
        if (!this.markdownReady) {
            return `<pre>${content}</pre>`;
        }
        let textContent;
        if (typeof content === 'string') {
            const match = content.match(/^```(\w+)/);
            textContent = content.replace(/^```\w+/, '```');
        } else if (typeof content === 'object') {
            textContent = content.content || 
                         content.message?.content ||
                         content.choices?.[0]?.message?.content ||
                         JSON.stringify(content, null, 2);
        } else {
            textContent = String(content);
        }
        let processedContent = textContent
            .replace(/&#x60;/g, '`')
            .replace(/&grave;/g, '`')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/```(\w*)/g, '\n```$1\n')
            .replace(/```\s*$/g, '\n```\n')
            .replace(/\n{3,}/g, '\n\n');
        try {
            const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                const validLanguage = language?.toLowerCase().trim() || 'typescript';
                let highlighted = code;
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                    } catch (e) {
                        console.error('Highlighting failed:', e);
                    }
                }
                return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
            };
            window.marked.setOptions({ renderer });
            const parsed = window.marked.parse(processedContent);
            setTimeout(() => {
                const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
                codeBlocks.forEach(block => {
                    Prism.highlightElement(block);
                });
            }, 0);
            return parsed;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre>${textContent}</pre>`;
        }
    }

    // =============
    // Send Message
    // =============
    async sendMessage() {
        const userMsg = this.inputField.value.trim();
        let apiRef = null;

        // Turn off the inspector when generate is clicked
        this.isInspecting = false;
        this.updateInspectorButtonState();

        if (this.selectedProvider === 'groq')   apiRef = this.groqAPI;
        else if (this.selectedProvider === 'openai')  apiRef = this.openaiAPI;
        else if (this.selectedProvider === 'watsonx')  apiRef = this.watsonxAPI;
        else apiRef = null;
        if (!apiRef) {
            this.addMessage(`Please set your ${this.selectedProvider} API key in the Settings tab.`, 'system');
            return;
        }
        if (!this.selectedDomContent) {
            const { combinedDomSnippet } = await chrome.storage.local.get(['combinedDomSnippet']);
            if (typeof combinedDomSnippet === 'string' && combinedDomSnippet.length > 0) {
                this.selectedDomContent = combinedDomSnippet;
            }
            if (!this.selectedDomContent) {
                this.addMessage('Please select DOM elements first using Inspect.', 'system');
                return;
            }
        }
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pageUrl = tab?.url || 'unknown';
            let javaGenMode = 'TEST';
            const lang = this.languageBindingSelect.value;
            const eng  = this.browserEngineSelect.value;
            this.codeGeneratorType = this.getPromptKey(lang, eng);
            if (this.codeGeneratorType.includes('SELENIUM_JAVA')) {
                const selectedRadio = document.querySelector('input[name="javaGenerationMode"]:checked');
                if (selectedRadio) {
                    javaGenMode = selectedRadio.value;
                }
            }
            const finalSnippet = typeof this.selectedDomContent === 'string'
                ? this.selectedDomContent
                : JSON.stringify(this.selectedDomContent, null, 2);
            const finalPrompt = getPrompt(this.codeGeneratorType, {
                domContent: finalSnippet,
                pageUrl: pageUrl,
                javaMode: javaGenMode
            });
            
            this.sendButton.disabled = true;
            this.inputField.disabled = true;
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.addMessage(userMsg, 'user');
            this.inputField.value = '';
            console.log("The API request >> "+finalPrompt);
            const response = await apiRef.sendMessage(finalPrompt, this.selectedModel);
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();
            console.log('[API Response]', response);
            const messageContent =
                response?.content ||
                response?.message?.content ||
                response?.choices?.[0]?.message?.content ||
                response;
            const inputTokens  = response.usage?.input_tokens  || 0;
            const outputTokens = response.usage?.output_tokens || 0;
            this.addMessageWithMetadata(messageContent, 'assistant', {
                inputTokens,
                outputTokens
            });
            this.selectedDomContent = null;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.isInspecting = false;
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SELECTION' });
                } catch (err) {
                    const port = chrome.tabs.connect(tab.id);
                    port.postMessage({ type: 'CLEAR_SELECTION' });
                    port.disconnect();
                }
            }
            // Save the generated code for download
            this.generatedCode = messageContent;
            // Enable the download button now that code is generated
            const downloadBtn = document.getElementById('downloadCode');
            if (downloadBtn) {
                downloadBtn.disabled = false;
            }
        } catch (err) {
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();
            this.addMessage(`Error: ${err.message}`, 'system');
        } finally {
            this.sendButton.disabled = false;
            this.inputField.disabled = false;
            this.sendButton.innerHTML = 'Generate';
        }
    }

    // ==============
    // addMessage UI
    // ==============
    addMessage(content, type) {
        if (!content) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${type}-message`;
        if (type === 'system') {
            msgDiv.innerHTML = content;
        } else {
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';
            markdownDiv.innerHTML = this.parseMarkdown(content);
            msgDiv.appendChild(markdownDiv);
        }
        this.messagesContainer.appendChild(msgDiv);
        if (type === 'user') {
            const loader = document.createElement('div');
            loader.className = 'loading-indicator';
            const genType = this.codeGeneratorType.includes('PLAYWRIGHT') ? 'Playwright' : 'Selenium';
            loader.innerHTML = `
              <div class="loading-spinner"></div>
              <span class="loading-text">Generating ${genType} Code</span>
            `;
            this.messagesContainer.appendChild(loader);
            setTimeout(() => loader.classList.add('active'), 0);
        }
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        const msgCount = this.messagesContainer.querySelectorAll('.chat-message').length;
        if (msgCount > 1 && this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }

    addMessageWithMetadata(content, type, metadata) {
        if (type !== 'assistant') {
            this.addMessage(content, type);
            return;
        }
        const container = document.createElement('div');
        container.className = 'assistant-message';
        const mdDiv = document.createElement('div');
        mdDiv.className = 'markdown-content';
        mdDiv.innerHTML = this.parseMarkdown(content);
        container.appendChild(mdDiv);
        const metaContainer = document.createElement('div');
        metaContainer.className = 'message-metadata collapsed';
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'metadata-toggle';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'metadata-toggle';
        copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`;
        copyBtn.onclick = () => {
            const codeBlocks = mdDiv.querySelectorAll('pre code');
            if (codeBlocks.length === 0) {
                copyBtn.innerHTML = `<i class="fas fa-times"></i> No content found`;
                setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`; }, 2000);
                return;
            }
            let combinedCode = Array.from(codeBlocks).map(block => block.textContent.trim()).join('\n\n');
            combinedCode = combinedCode.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '');
            navigator.clipboard.writeText(combinedCode)
                .then(() => {
                    copyBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    copyBtn.innerHTML = `<i class="fas fa-times"></i> Failed to copy`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                });
        };
        actions.appendChild(toggleBtn);
        actions.appendChild(copyBtn);
        metaContainer.appendChild(actions);
        const details = document.createElement('div');
        details.className = 'metadata-content';
        details.innerHTML = `
          <div class="metadata-row"><span>Input Tokens:</span><span>${metadata.inputTokens}</span></div>
          <div class="metadata-row"><span>Output Tokens:</span><span>${metadata.outputTokens}</span></div>
        `;
        metaContainer.appendChild(details);
        container.appendChild(metaContainer);
        this.messagesContainer.appendChild(container);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        if (this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }
    
    updateInspectorButtonState() {
        if (this.isInspecting) {
            this.inspectorButton.classList.add('active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Stop</span>
            `;
        } else {
            this.inspectorButton.classList.remove('active');
            if (!this.selectedDomContent) {
                this.inspectorButton.classList.remove('has-content');
            }
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
        }
    }

    getPromptKey(language, engine) {
        // For checkboxes or multiple selection
        const selectedInputs = document.querySelectorAll('input[name="javaGenerationMode"]:checked');
        const eng  = this.browserEngineSelect.value;

        if (language === 'java' && engine === 'selenium') {
            if (!selectedInputs || selectedInputs.length === 0) {
                return 'SELENIUM_JAVA_PAGE_ONLY';
            }
            const selectedValues = Array.from(selectedInputs).map(input => input.value);

            if (selectedValues.includes('PAGE') && selectedValues.includes('FEATURE')) {
                return 'SELENIUM_JAVA_PAGE_FEATURE';
            }
            if (selectedValues.includes('PAGE') && selectedInputs.length === 1) {
                return 'SELENIUM_JAVA_PAGE_ONLY';
            }
            if (selectedValues.includes('XPATH') && selectedInputs.length === 1) {
                return 'XPATH_ONLY';
            }
            if (selectedValues.includes('FEATURE') && selectedInputs.length === 1) {
                return 'CUCUMBER_ONLY';
            }
        }

        if (language === 'typescript' && engine === 'playwright') {
            // For radio buttons (single selection)
            const selectedRadio = document.querySelector('input[name="javaGenerationMode"]:checked');
            if (!selectedRadio) {
                return 'PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY';
            }
            const radioValue = selectedRadio.value;
            if (selectedValues.includes('PAGE') && selectedInputs.length === 1) {
                return 'PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY';
            } else {
                return 'CUCUMBER_ONLY';
            }
        }
        return 'SELENIUM_JAVA_PAGE_ONLY';
    }

    async initializeCodeGeneratorType() {
        const { codeGeneratorType } = await chrome.storage.sync.get(['codeGeneratorType']);
        if (codeGeneratorType) {
            this.codeGeneratorType = codeGeneratorType;
            const codeGenDrop = document.getElementById('codeGeneratorType');
            if (codeGenDrop) codeGenDrop.value = this.codeGeneratorType;
        }
    }

    async initializeTokenThreshold() {
        const { tokenWarningThreshold } = await chrome.storage.sync.get(['tokenWarningThreshold']);
        if (tokenWarningThreshold) {
            this.tokenWarningThreshold = tokenWarningThreshold;
        }
        const threshInput = document.getElementById('tokenThreshold');
        if (threshInput) {
            threshInput.value = this.tokenWarningThreshold;
            threshInput.addEventListener('change', async (e) => {
                const val = parseInt(e.target.value,10);
                if (val >= 100) {
                    this.tokenWarningThreshold = val;
                    await chrome.storage.sync.set({ tokenWarningThreshold: val });
                } else {
                    e.target.value = this.tokenWarningThreshold;
                }
            });
        }
    }

    async resetChat() {
        try {
            this.messagesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                </div>
            `;
            this.selectedDomContent = null;
            this.isInspecting       = false;
            this.markdownReady      = false;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.inputField.value = '';
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Generate';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
                } catch (err) {
                    console.log('Cleanup error:', err);
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (err) {
                    if (!err.message.includes('already been injected')) {
                        console.error('Re-inject error:', err);
                    }
                }
            }
            if (this.resetButton) {
                this.resetButton.classList.remove('visible');
            }
            this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');
        } catch (err) {
            console.error('Error resetting chat:', err);
            this.addMessage('Error resetting chat. Please close and reopen.', 'system');
        }
    }

    // ==============
    // Git Integration
    // ==============
    async pushToGit() {
        const gitUrl = document.getElementById('gitUrl').value.trim();
        const repoName = document.getElementById('repoName').value.trim();
        const branchName = document.getElementById('branchName').value.trim();
        const gitToken = document.getElementById('gitToken').value.trim();
        const commitMessage = document.getElementById('commitMessage')?.value || 'Add generated code';
        const code = this.generatedCode || '';
        const fileName = this.getGeneratedFileName();

        const gitApi = new GitAPI(gitToken);
        try {
            await gitApi.pushFile({
                gitUrl,
                repoName,
                branchName,
                fileName,
                content: code,
                commitMessage
            });
            alert('Code pushed to GitHub!');
        } catch (err) {
            alert('Git push failed: ' + err.message);
        }
    }

    initializeGitSettings() {
        // Load Git settings from chrome.storage.sync
        chrome.storage.sync.get(
            ['gitUrl', 'repoName', 'branchName', 'gitToken', 'commitMessage'],
            (result) => {
                if (result.gitUrl)      document.getElementById('gitUrl').value = result.gitUrl;
                if (result.repoName)    document.getElementById('repoName').value = result.repoName;
                if (result.branchName)  document.getElementById('branchName').value = result.branchName;
                if (result.gitToken)    document.getElementById('gitToken').value = result.gitToken;
                if (result.commitMessage) document.getElementById('commitMessage').value = result.commitMessage;
            }
        );

        // Save Git settings on input change
        ['gitUrl', 'repoName', 'branchName', 'gitToken', 'commitMessage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const obj = {};
                    obj[id] = el.value;
                    chrome.storage.sync.set(obj);
                });
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
});
