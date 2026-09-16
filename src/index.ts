// src/index.ts

// 第一步：加载环境变量（必须在最顶部）
import "dotenv/config";

// 第二步：导入 LangChain 核心功能
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { getWeather } from "./tools/weather";

// 第四步：创建 Agent

// openai只需传入模型的标识即可
// const agent = createAgent({
//   model: "openai:gpt-4o",
//   tools: [getWeather],
// });

// 千问模型需要先创建一个模型实例
const model = new ChatOpenAI({
  model: "qwen3.8-27b",
  apiKey: process.env.QIANWEN_API_KEY,
  configuration: {
    baseURL: process.env.QWEN_API_URL,
  },
  temperature: 0.3,
});


// 创建的模型作为model参数传给createAgent
const agent = createAgent({
  model,
  tools: [getWeather],
  systemPrompt: "你是智能助手，可以调用工具完成用户问题。工具返回结果后整理成自然中文回答",
});


const stream = await agent.stream(
  { messages: [{ role: "user", content: "广州和深圳今天天气怎么样？" }] },
  { streamMode: "messages" }  // 流式返回每次状态更新
);

// 遍历流式数据
const normalizeContent = (content: unknown): string => {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }

  return "";
};

for await (const [message] of stream) {
  // 逐字符输出，实现打字机效果
  const text = normalizeContent(message.content);
  if (text) {
    process.stdout.write(text);
  }
}

  

