import 'dotenv/config';
import { MCPAdapter } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import chalk from 'chalk';
import { HumanMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({
  model: "qwen3.8-max-0902",
  apiKey: process.env.QIANWEN_API_KEY,
  configuration: {
    baseURL: process.env.QWEN_API_URL,
  },
});

const adapter = new MCPAdapter({
  servers: {
    'my-mcp-server': {
      command: 'node',
      args: ['./src/my-mcp-server.mjs'],
    },
  },
});

const tools = await adapter.listTools();
const modelWithTools = model.bindTools(tools);

const res = await adapter.listResources();
let resourceContent = '';
for (const [serverName, resources] of Object.entries(res)) {
  for (const resource of resources) {
    const content = await adapter.readResource(serverName, resource.uri);
    resourceContent += content[0].text;
  }
}


async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(resourceContent),
    new HumanMessage(query)
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen('⏳ 正在等待 AI 思考...'));
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find(t => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        messages.push(new ToolMessage({
          content: toolResult,
          tool_call_id: toolCall.id,
        }));
      }
    }
  }

  return messages[messages.length - 1].content;
}

await runAgentWithTools('查一下用户 002 的信息');

await adapter.close();