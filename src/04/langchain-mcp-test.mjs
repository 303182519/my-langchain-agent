import "dotenv/config";
import { MCPAdapter } from '@langchain/mcp-adapters';
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const adapter = new MCPAdapter({
  servers: {
    'my-mcp-server': {
      command: 'node',
      args: ['./src/04/my-mcp-server.mjs'],
    },
  },
});

const tools = await adapter.listTools();
const modelWithTools = model.bindTools(tools);

// 读取 MCP Resource 并注入上下文
async function loadResourceContext() {
  // 获取所有 MCP Server 的资源列表
  // 返回一个对象，key 是 server name，value 是资源列表
  const res = await adapter.listResources();

  let resourceContent = "";
  for (const [serverName, resources] of Object.entries(res)) {
    for (const resource of resources) {
      const content = await adapter.readResource(
        serverName,
        resource.uri
      );
      resourceContent += content[0].text + "\n";
    }
  }

  // 拼接成字符串，注入到 SystemMessage 中作为 AI 的背景知识
  // 这样模型就能理解服务器提供了哪些功能和文档。
  return resourceContent;
}

// Agent 执行函数
// query: 用户查询
// resourceContext: 资源上下文
// maxIterations: 最大迭代次数
async function runAgentWithTools(query, resourceContext, maxIterations = 30) {
  const messages = [
    new SystemMessage(resourceContext), // 注入 resource 作为上下文
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));

    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(
      chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`)
    );
    
    console.log(
      chalk.bgBlue(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`
      )
    );

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);
        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          })
        );
      }
    }
  }

  return messages[messages.length - 1].content;
}

try {
  const resourceContext = await loadResourceContext();

  await runAgentWithTools(
    "MCP Server 的使用指南是什么",
    resourceContext
  );

  await runAgentWithTools(
    "查一下用户 002 的信息",
    resourceContext
  );
} finally {
  await adapter.close();
}