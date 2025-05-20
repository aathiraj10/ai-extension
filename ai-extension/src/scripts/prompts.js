/**
 * Collection of default prompts for different use cases
 */
export const DEFAULT_PROMPTS = {
  /**
   * Prompt for generating Selenium Java test code ONLY
   * (No page object class at all).
   */
  SELENIUM_JAVA_TEST_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Selenium Java TEST CLASS using TestNG (no page object class).
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - The elements found using locators should be either one of these tags only: input, button, select, a, div
       - By.id (only if the id doesn’t contain multiple digits like "ext-gen623")
       - By.name
       - By.linkText or partialLinkText for links
       - By.cssSelector (avoid using any attribute containing "genai")
       - By.xpath only if others aren’t suitable
    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use TestNG for assertions
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods
       - No new page object class is needed—pretend we already have it.
       - DO NOT show the PageFactory or any page class reference

    3. Code structure:
       - Show only a single test class
       - @BeforeMethod, @Test, and @AfterMethod
       - Use meaningful method names
       - Use properties file for config if you want
       - Provide only the test class code block, no other text

    Example:
    \`\`\`java
    package com.genai.tests;

    import org.openqa.selenium.WebDriver;
    import org.openqa.selenium.chrome.ChromeDriver;
    import org.openqa.selenium.support.ui.WebDriverWait;
    import org.testng.annotations.*;
    import java.time.Duration;

    public class ComponentTest {
        private WebDriver driver;
        private WebDriverWait wait;

        @BeforeMethod
        public void setUp() {
            driver = new ChromeDriver();
            wait = new WebDriverWait(driver, Duration.ofSeconds(10));
            driver.manage().window().maximize();
            driver.get("\${pageUrl}");
        }

        @Test
        public void testComponentAction() {
            // Implementation
        }

        @AfterMethod
        public void tearDown() {
            if (driver != null) {
                driver.quit();
            }
        }
    }
    \`\`\`
  `,

  /**
   * Prompt for generating Selenium Java Page class ONLY
   * (No test class).
   */
  SELENIUM_JAVA_PAGE_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Selenium Java PAGE OBJECT CLASS for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - By.id (avoid if the id has more than a single number)
       - By.name
       - By.linkText or partialLinkText for links
       - By.xpath (use relative or following or preceding based on best case)
       - By.cssSelector (avoid "genai" attributes) only if others aren’t suitable

    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods & class

    3. Code structure:
       - Single page class
       - [CRITICAL] Do not generate the constructure
       - [MANDATORY] Do not add waits as my framework already has it
       - Add comments to every method that you generate
       - Provide only the code block, no other text
       - Add reportStep clearly mentioning which page the action is performed
       - Make sure the output content is adding 3 back slashes \`\`\`java\n before and after the generated code

    Example:
    \`\`\`java
    package com.salesforce.pages;

    import com.framework.selenium.api.design.Locators;
    import com.framework.testng.api.base.ProjectSpecificMethods;

    public class ComponentPage extends ProjectSpecificMethods {

        // Constructor

        // Method

    }

    \`\`\`
  `,

  /**
   * Prompt for generating Cucumber Feature file
   */
  CUCUMBER_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want a **Cucumber (Gherkin) .feature file** referencing **every relevant field** in the DOM snippet.

    **Instructions**:
    1. **Do not** include any explanations or extra text beyond the .feature content.
    2. **Identify** each relevant element (input, textarea, select, button, etc.).
    3. For each element, **create one step** referencing a placeholder (e.g. \`<fieldName>\`):
    4. Use a **Scenario Outline** + **Examples** to parametrize these placeholders.
    5. **Ensure one action per step**.
    6. Output **only** valid Gherkin in a single \`\`\`gherkin code block.

    Produce **only** the .feature content as below:
    \`\`\`gherkin
    Feature: Describe your feature

      Scenario Outline: A scenario describing \${userAction}
        Given I open "\${pageUrl}"
        When I type <companyName> into the Company Name field
        And I type <firstName> into the First Name field
        And I select <state> in the State/Province dropdown
        And I click the Create Lead button
        Then I should see <some expected outcome>

      Examples:
        | companyName   | firstName   | state |
        | "Acme Corp"   | "Alice"     | "TX"  |
        | "Mega Corp"   | "Bob"       | "FL"  |
    \`\`\`
  `,
  /**
   * Prompt for generating playwright Typescript test
   */  
  PLAYWRIGHT_TYPESCRIPT_TEST_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Playwright TypeScript PAGE OBJECT CLASS for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - The elements found using locators should be either one of these tags only: input, button, select, a, div
       - By.id (only if the id doesn’t contain multiple digits like "ext-gen623")
       - By.name
       - By.linkText or partialLinkText for links
       - By.cssSelector (avoid using any attribute containing "genai")
       - By.xpath only if others aren’t suitable
    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use TestNG for assertions
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods
       - No new page object class is needed—pretend we already have it.
       - DO NOT show the PageFactory or any page class reference

    3. Code structure:
       - Show only a single test class
       - @BeforeMethod, @Test, and @AfterMethod
       - Use meaningful method names
       - Use properties file for config if you want
       - Provide only the test class code block, no other text

    Example:
    \`\`\`typescript
    import { test, expect } from '@playwright/test';
    import { chromium } from 'playwright';

    test('component action test', async ({ page }) => {
    // Setup
    const browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('your-page-url');

    // Test implementation
    // Add your test actions here

    // Cleanup
    await browser.close();
    });
    \`\`\`
  `,
    /**
   * Prompt for generating playwright typescript Page object file
   */
  PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Playwright TypeScript PAGE OBJECT CLASS for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - The elements found using locators should be either one of these tags only: input, button, select, a, div
       - By.id (only if the id doesn’t contain multiple digits like "ext-gen623")
       - By.name
       - By.linkText or partialLinkText for links
       - By.cssSelector (avoid using any attribute containing "genai")
       - By.xpath only if others aren’t suitable
    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use TestNG for assertions
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods
       - No new page object class is needed—pretend we already have it.
       - DO NOT show the PageFactory or any page class reference

    3. Code structure:
       - Show only a single test class
       - @BeforeMethod, @Test, and @AfterMethod
       - Use meaningful method names
       - Use properties file for config if you want
       - Provide only the test class code block, no other text

    Example:
    \`\`\`typescript
    import { test, expect } from '@playwright/test';
    import { chromium } from 'playwright';

    test('component action test', async ({ page }) => {
    // Setup
    const browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('your-page-url');

    // Test implementation
    // Add your test actions here

    // Cleanup
    await browser.close();
    });
    \`\`\`
  `,
  /**
   * Prompt for generating Xpath only
   */
  XPATH_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a xpath, css selector and locator for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}
        
    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - The elements found using locators should be either one of these tags only: input, button, select, a, div
       - By.id (only if the id doesn’t contain multiple digits like "ext-gen623")
       - By.name
       - By.linkText or partialLinkText for links
       - By.cssSelector (avoid using any attribute containing "genai")
       - By.xpath only if others aren’t suitable
    2. Code structure:
       - Show only the xpath, locator and css locator
       - DO NOT ADD ANY OTHER TEXT

    Example:
    \`\`\`Elementt 1
    XPath: //input[@id='inputEmail']
    CSS:   #inputEmail
    Locator: By.id("inputEmail")

    Element 2
    XPath: //input[@id='lastNameInput']
    CSS:   #lastNameInput
    Locator: By.id("lastNameInput")
    \`\`\`
  `  
};

/**
 * Helper function to escape code blocks in prompts
 */
function escapeCodeBlocks(text) {
  return text.replace(/```/g, '\\`\\`\\`');
}

/**
 * Function to fill template variables in a prompt
 */
export function getPrompt(promptKey, variables = {}) {
  let prompt = DEFAULT_PROMPTS[promptKey];
  if (!prompt) {
    throw new Error(`Prompt not found: ${promptKey}`);
  }

  // Replace all variables in the prompt
  Object.entries(variables).forEach(([k, v]) => {
    const regex = new RegExp(`\\\${${k}}`, 'g');
    prompt = prompt.replace(regex, v);
  });

  return prompt.trim();
}

export const CODE_GENERATOR_TYPES = {
  SELENIUM_JAVA_PAGE_ONLY: 'Selenium-Java-Page-Only',
  SELENIUM_JAVA_TEST_ONLY: 'Selenium-Java-Test-Only',
  CUCUMBER_ONLY: 'Cucumber-Only',
  PLAYWRIGHT_TYPESCRIPT_PAGE_ONLY: 'Playwright-Typescript-Page-Only',
  PLAYWRIGHT_TYPESCRIPT_TEST_ONLY: 'Playwright-Typescript-Test-Only',
  XPATH_ONLY: 'Xpath-Generation-Only'
};
