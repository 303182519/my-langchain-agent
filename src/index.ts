// 第一步：加载环境变量（必须在最顶部）
import "dotenv/config";

import { agent } from "./agents/main";

const stream = await agent.stream(
  { messages: [{ role: "user", content: "广州和深圳今天天气怎么样？" }] },
  { 
    streamMode: "messages", // 流式返回每次状态更新
    configurable: {
      thread_id: "thread-123",
      maxIterations: 3  // 限制最大工具调用次数，防止无限循环
    }
  },
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

  

