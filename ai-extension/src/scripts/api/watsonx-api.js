class WatsonxAPI {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.baseUrl = 'https://eu-de.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-05-16';
    }

    extractBlock(text) {
      const regex = /(```[\s\S]*?```)/;
      const match = text.match(regex);
      return match && match[1] ? match[1].trim() : text;
    }

    async sendMessage(prompt, modelName) {
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model_id: modelName,
            project_id: "58e93b8e-fb79-4149-84a6-4dacab98e2c5",
            input: prompt,
            parameters: {
            decoding_method: "sample",
            max_new_tokens: 8000,
            temperature: 0.1
            },
          })
        });
  
        if (!response.ok) {
          const errorData = await response.text();
          console.error('API Response:', response.status, errorData);
          throw new Error(`API call failed: ${response.status} - ${errorData}`);
        }
  
        const data = await response.json();
        console.log('Watsonx API response:', data);
  
        // Extract the entire code block (with ``` and closing ```)
        const rawContent = data.choices[0].message.content;
        const responseContent = this.extractBlock(rawContent);
  
        return {
          content: responseContent
        };
      } catch (error) {
        console.error('Error calling Watsonx API:', error);
        throw error;
      }
    }
}